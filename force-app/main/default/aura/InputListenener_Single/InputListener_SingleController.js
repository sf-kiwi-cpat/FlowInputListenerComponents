({
    // Called on load of the component
    doInit: function(cmp, event, helper) {
        if (helper.checkRecordId(cmp))
        {
            helper.setupType(cmp);
            helper.subscribeToVoiceToolkit(cmp);
        }
    },
    
    onDestroy: function(cmp, event, helper) {
        helper.unsubscribeFromVoiceToolkit(cmp);
    },
    
    // Chat Transcript Customer
    onChatTranscriptCustomer: function(cmp, evt, helper) {
        helper.chatConversationEventListener(cmp, evt, 'EndUser');        
    },
    
    // Chat Transcript Agent
    onChatTranscriptAgent: function(cmp, evt, helper) {
        helper.chatConversationEventListener(cmp, evt,'Agent');
    }, 
    
    // Called when the toggle to listen for events is flipped
    setIsListening: function(cmp, evt, helper) {
        helper.onListeningCheckboxUpdate(cmp, evt);
    }
})