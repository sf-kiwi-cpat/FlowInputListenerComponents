({
    checkRecordId: function(cmp) {
        let componentRecordId = cmp.get("v.recordId");
        let isValid = true;
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
    setupType: function(cmp) { 
        let type = cmp.get("v.fieldType").toLowerCase();
        let regex = null;
        let componentRecordId = cmp.get("v.recordId");

        //console.log("Setting Type: " + type);
        
        if (type === "text") {
            // We don't need to check the contents of the field, just fill it in.
            cmp.set("v.useRegex",false);
            cmp.set("v.inputType","text");
        }
        else if (type === "textarea") {
            // We don't need to check the contents of the field, just fill it in.
            cmp.set("v.useRegex",false);
            cmp.set("v.inputType","textarea");
        }
        else if (type === "number" || type === "currency")
        {
            // Match numbers, including negative numbers and decimal points
            // Needs to handle the written versions as well, especially for voice.
            regex = "(-?\\d+(,[0-9]+)*\.?\\d*)|(zero|one|two|three|four|five|six|seven|eight|nine)"; 
            cmp.set("v.regexModifiers", "mi"); // make this case insensitive.
            cmp.set("v.inputType","number");
        }
        else if (type === "email")
        {
            regex = '\\S+@\\S+\\.\\S+'; // Using a simple email regex, the agent can manually determine/update if required
            cmp.set("v.inputType",type);
        }
        else if (type === "phone")
        {
            regex = "\\+?\\d+"; // Strip it down to just digits and let the UI handle the display of it from there.
            cmp.set("v.inputType","tel");   
        }
        else if (type === "checkbox" || type === "toggle")
        {
            regex = 'yes|yep|yea|sure|ok|true'; // Some basic/standard positive responses.
            cmp.set("v.regexModifiers", "mi"); // make this case insensitive.
			cmp.set("v.inputType",type); // checkbox and toggle are both the correct value.
            // Need to do a type conversion from String to boolean
            if (cmp.get("v.textFieldValue") !== "true")
            {
                cmp.set("v.textFieldValue",null);
            }

        }
        else if (componentRecordId)
        {
            // Display this error message, so long as we haven't displayed the no record ID one from earlier.
            cmp.set("v.errorToDisplay", "Invalid type set of " + cmp.get("v.fieldType") + ". Please set a valid value - one of: Text, TextArea, Number, Currency, Phone, Email, Checkbox or Toggle");
            this.showMessage(cmp, false);
        }
        
        // Override the regex above if a custom one is passed in.
        const customRegex = cmp.get("v.customRegex");
        if (customRegex)
        {
            regex = customRegex;
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
        if (componentRecordId.startsWith("0LQ"))
        {
            cmp._conversationEventListener = $A.getCallback(this.voiceConversationEventListener.bind(this, cmp));
            cmp.find('voiceToolkitApi').addConversationEventListener('TRANSCRIPT', cmp._conversationEventListener);
        }
    },
    
    unsubscribeFromVoiceToolkit: function(cmp) {
        let componentRecordId = cmp.get("v.recordId");
        // Only subscribe if we are listening on a voice call
        if (componentRecordId.startsWith("0LQ"))
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
        
        if (speaker=='EndUser'){
            //console.log("End user event, isListening:", listeningValue);
            if (listeningValue) {
                let strippedText = transcriptText;
                //console.log("useRegex: " + useRegex);
                if (useRegex) {
                    // Run the regex over the input text to see if it is valid.
                    let regexToUse = cmp.get("v.validationRegex");
                    //console.log("regexToUse: " + regexToUse);
                    //console.log("Text to use regex on: " + strippedText);
                    let regex = new RegExp(regexToUse, cmp.get("v.regexModifiers"));
				                    
                    let matchedText = regex.exec(strippedText);
                    //console.log("matchedText: " + matchedText);
                    if (matchedText && matchedText[0]) {
                        // Found a match from the regex
                        strippedText = matchedText[0];
                    }
                    else {
                        // No text matching the regex
                        strippedText = "";
                    }
                }
                
                if (this.isValidInput(cmp, strippedText)) {
                    this.setComponentValue(cmp, strippedText);
                    
                    this.showMessage(cmp, true);
                    // Now that we've got our input lets stop listening
                    this.updateListeningValue(cmp,false);
                }
                else
                {
                    // We got an error - show the messsage/reason back to the agent.
                    this.showMessage(cmp, false);
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
        let visibleCmp = cmp.find('infoSection');
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
	
    setComponentValue: function(cmp, value) {
        let type = cmp.get("v.inputType").toLowerCase();
        if (type === "checkbox" || type === "toggle") 
        {
            // For this, we need to set it to true rather than the value
            cmp.set("v.textFieldValue", true);
        }
        else if (type === "number" || type === "currency")
        {
            //console.log("checking type " + isNaN(parseFloat(value)));
            // We may have the written version of a number, so we will do a replace. (Service Cloud Voice writes out the full text for numbers 0-9)
            if (isNaN(parseFloat(value)))
            {
                let stringValue = String(value);
                switch (stringValue) {
                    case "zero" :
                        value = 0;
                        break;
                    case "one" :
                        value = 1;
                        break;
                    case "two":
                        value = 2;
                        break;
                    case "three":
                        value = 3;
                        break;
                    case "four":
                        value = 4;
                        break;
                    case "five":
                        value = 5;
                        break;
                    case "six":
                        value = 6;
                        break;
                    case "seven":
                        value = 7;
                        break;
                    case "eight":
                        value = 8;
                        break;
                    case "nine":
                        value = 9;
                        break;
                    default :
                        break; // Just here as security review brings it up otherwise
                }
            }
            //console.log("Setting value to: " + value);
            cmp.set("v.textFieldValue", value);
        }
        else
        {
            cmp.set("v.textFieldValue", value);
        }
    },
    
    onListeningCheckboxUpdate: function(cmp, evt) {
        // This is when the toggle to start listening was clicked by the agent
        let checkValue = evt.getSource().get('v.value');
        //console.log(checkValue);    
        this.updateListeningValue(cmp, checkValue);
    },
    
    updateListeningValue: function(cmp, valueToSet)
    {
        //console.log("Setting listening to: " + valueToSet);
        cmp.set("v.isListening", valueToSet);
        let checkboxComponent = cmp.find("chkboxListening");
        // Ensure the check box stays in sync with the value
        if (checkboxComponent && checkboxComponent.get("v.value") != valueToSet)
        {
            checkboxComponent.set("v.value",valueToSet);
        }
    }
})