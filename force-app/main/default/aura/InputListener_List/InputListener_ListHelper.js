({  
    checkRecordId: function(cmp) {
        let componentRecordId = cmp.get("v.recordId");
        let isValid = true;
        //console.log("top rec ID", componentRecordId);
        if (!componentRecordId)
        {
            cmp.set("v.errorToDisplay", "No record ID set - please ensure you are passing the record ID to your Flow from App Builder");
            this.showMessage(cmp, false);
            isValid = false;
        }
        else if (!(componentRecordId.startsWith("0Mw") || componentRecordId.startsWith("570") || componentRecordId.startsWith("0LQ")))
        {
            // Must be of type Messaging Session (0Mw), Chat transcript (570) or Voice call (0LQ)
           	cmp.set("v.errorToDisplay", "Record ID is not of a supported object - ensure you are passing a Messaging Session, Chat Transcript or Voice Call record Id.");
            this.showMessage(cmp, false);
            isValid = false;
        }
        return isValid;
    },
    doInitValues: function(cmp) {
        var valueToInit = cmp.get("v.textFieldValue");
        let type = cmp.get("v.fieldType");
        
        if (type === 'checkbox' && valueToInit) {
            var options = valueToInit.split(',');
            cmp.set("v.listFieldValue", options);
        }
    },
    setupType: function(cmp) { 
        let type = cmp.get("v.fieldType") ? cmp.get("v.fieldType").toLowerCase().trim() : null;
		// Regex we're going to build up to match the values of the list
        let regex = null;
        //console.log("Setting Type: " + type);
        
        let listOptions = cmp.get("v.options");
        let listValues = cmp.get("v.listValues");
        let optionsList = listValues.split(",");
        
        //check fieldType (from flow) to ensure a valid entry 
        if (type && (type === 'radio' || type ==='picklist' || type==='checkbox')) {
            
            cmp.set("v.fieldType",type);
            //Populate UI with values entered in 'fieldType' field in the flow
            for (let i=0; i < optionsList.length; i++) {
                let optionValue = optionsList[i].toLowerCase().trim();
                let option = {'label': optionsList[i], 'value': optionValue};
                listOptions.push(option);
                
                // Build up the regex as we iterate (basically an 'or' for each value)
                if (!regex) {
                    // First time through
                    regex = optionValue;
                }
                else {
                    // Add the pipe which indicates 'or' for regular expressions
                    regex += "|" +optionValue;
                }
        	}
            //console.log("this is the regex: ", regex);
            //console.log("these are the listOptions", listOptions);
            cmp.set("v.options", listOptions);
        }
        else
        {
            cmp.set("v.errorToDisplay", "Invalid type set of " + cmp.get("v.fieldType") + ". Please set a valid value - one of: Radio,Picklist,Checkbox");
            this.showMessage(cmp, false);
        }
        
        if (regex)
        {
            cmp.set("v.useRegex",true);
            cmp.set("v.validationRegex", regex);
            //console.log("Setting Regex: " + regex);
        }
    }, 
    
    subscribeToVoiceToolkit: function(cmp) { 
        let componentRecordId = cmp.get("v.recordId");
        // Only subscribe if we are listening on a voice call
        if (componentRecordId && componentRecordId.startsWith("0LQ"))
        {
            cmp._conversationEventListener = $A.getCallback(this.voiceConversationEventListener.bind(this, cmp));
            cmp.find('voiceToolkitApi').addConversationEventListener('TRANSCRIPT', cmp._conversationEventListener);
        }
    },
    
    unsubscribeFromVoiceToolkit: function(cmp) {
        let componentRecordId = cmp.get("v.recordId");
        // Only subscribed if we are listening on a voice call
        //console.log("this is the rec ID", componentRecordId);
        
        if (componentRecordId && componentRecordId.startsWith("0LQ"))
        {
            cmp.find('voiceToolkitApi').removeConversationEventListener('TRANSCRIPT', cmp._conversationEventListener);
            //console.log("this is the voice toolkit unsub result:", cmp.find('voiceToolkitApi').removeConversationEventListener('TRANSCRIPT', cmp._conversationEventListener));
        }
    },
    
    // Voice Transcripts (Customer and Agent)
    voiceConversationEventListener: function(cmp, transcript) {      
        if (transcript) {
            try {
                //OG Version of TranscriptText and Speaker from this component
                let transcriptText = transcript.detail.content.text;
                let speaker = transcript.detail.sender.role;
                // Need to add validation in here that it is the right call object - need to fetch the call key.
               	let callKey = cmp.get('v.record.VendorCallKey');
                //console.log("Call Key = " + callKey);
                //console.log("transcript.detail.callId = " + transcript.detail.callId);
                if (callKey === transcript.detail.callId) {
                    // If not, drop out
                    this.checkIsListening(cmp, transcriptText, speaker);
                }             
            } catch(error) {
                //console.log('Error getting transcript text. ' + error);
            }
        }       
    },
    
    // Chat/Messaging Transcripts (Customer and Agent)
    chatConversationEventListener: function(cmp, evt, speaker) {
        let eventRecordId = evt.getParam('recordId');
        let componentRecordId = cmp.get("v.recordId");
        // We need to check that this event is for the appropriate record/session (e.g. could have multiple messaging sessions or chats going)
        //console.log("Event is from: " + eventRecordId);
        //console.log("Component is for: " + componentRecordId);
        // The event ID is the 15 digit ID, whereas the component version is the 18 digit ID. So we need to use starts with to compare
        if (componentRecordId && componentRecordId.startsWith(eventRecordId))
        {
            let transcriptText = evt.getParam('content');
            this.checkIsListening(cmp, transcriptText, speaker);
        }
        else
        {
            //console.log("Event is not for this record, ignoring.");
        }
    },
    
    // Checks that the input received is valid for this component
    isValidInput: function(cmp, input) {
        //console.log("Text being validated: " + input);
        let isValid = true; // return true for no errors
        // Basic check that this isn't empty - an earlier check on the regex will have stripped this down.
        if (!input || input.length == 0)
        {
            isValid = false;
            let preSetErrorMessage = cmp.get("v.errorMessage");
            if (preSetErrorMessage)
            {
                cmp.set("v.errorToDisplay", preSetErrorMessage);
            }
            else
            {
                cmp.set("v.errorToDisplay", "No content of type " + cmp.get("v.fieldType") + " detected in input.");
            }
        }
        //console.log("validation result: " + isValid);
        return isValid;
    },
    
    checkIsListening: function(cmp, transcriptText, speaker) {
        let activeKeyword = cmp.get("v.activeKeyword");
        let inactiveKeyword = cmp.get("v.inactiveKeyword");
        let listeningValue = cmp.get("v.isListening");
        let useRegex = cmp.get("v.useRegex");
        let type = cmp.get("v.fieldType").toLowerCase();
        
        //console.log("this is the transcript text: ", transcriptText);
        
        if (speaker=='EndUser'){
            //console.log("End user event, isListening:", listeningValue);
            let regexToUse = cmp.get("v.validationRegex");
            var regex = new RegExp(regexToUse, "g");
            if (listeningValue) {
                let strippedText = transcriptText.toLowerCase();
                var matchWord = "";
                var checkboxMatches = [];

                //console.log("useRegex: " + useRegex);
                if (useRegex) {  
                    //console.log("strippedText:", strippedText);
                    var array1;
                    while ((array1 = regex.exec(strippedText)) !== null) {
                        //console.log("*******", array1[0]);
                        matchWord = array1[0];
                        checkboxMatches.push(matchWord);
                    }
                }
                
                if (this.isValidInput(cmp, matchWord)) {
                    // set the value for multi-select fields
                    if (type === 'checkbox'){
                         cmp.set("v.listFieldValue", checkboxMatches);
                         cmp.set("v.textFieldValue", checkboxMatches.join(','));
                    } else {
                       cmp.set("v.textFieldValue", matchWord); 
                    }
                    this.showMessage(cmp, true);
                    // Now that we've got our input lets stop listening
                    this.updateListeningValue(cmp,false);
                }
                else
                {
                    // We got an error - show the messsage/reason back to the agent.
                    this.showMessage(cmp, false);
                    cmp.set("v.errorToDisplay", "Invalid field type. Please enter a value of 'Radio', 'Picklist', or 'Checkbox'");
                }
            }
        }
        
        if (speaker=='Agent' && transcriptText){
            if (activeKeyword && transcriptText.toLowerCase().includes(activeKeyword.toLowerCase())){
                this.updateListeningValue(cmp,true);
            } 
            else if (inactiveKeyword && transcriptText.toLowerCase().includes(inactiveKeyword.toLowerCase())){
                this.updateListeningValue(cmp,false);
            } 
        }
    },
    
    showMessage: function(cmp, success) {
        // Show the information section with a message to let the agent know it was detected
        var visibleCmp = cmp.find('infoSection');
        // Make it visible as it is hidden on load
        $A.util.removeClass(visibleCmp, 'notVisible');
        $A.util.addClass(visibleCmp, 'makeVisible');
        
        // Now set the text and color it as appropriate based on success or error
        if (success)
        {
            cmp.set("v.infoMessage", cmp.get("v.successMessage"));
            // Swap visibility of the sections
            $A.util.removeClass(visibleCmp, 'error');
            $A.util.addClass(visibleCmp, 'success');
        }
        else
        {
            cmp.set("v.infoMessage", cmp.get("v.errorToDisplay"));
            // Show the error section with a message to let the agent know it was detected
            $A.util.removeClass(visibleCmp, 'success');
            $A.util.addClass(visibleCmp, 'error');
        }
    },
    
    onListeningCheckboxUpdate: function(cmp, evt) {
        // This is when the toggle to start listening was clicked by the agent
        var checkValue = evt.getSource().get('v.value');
        //console.log(checkValue);    
        this.updateListeningValue(cmp, checkValue);
    },
    
    updateListeningValue: function(cmp, valueToSet)
    {
        //console.log("Setting listening to: " + valueToSet);
        cmp.set("v.isListening", valueToSet);
        var checkboxComponent = cmp.find("chkboxListening");
        // Ensure the check box stays in sync with the value
        if (checkboxComponent && checkboxComponent.get("v.value") != valueToSet)
        {
            checkboxComponent.set("v.value",valueToSet);
        }
    }
})