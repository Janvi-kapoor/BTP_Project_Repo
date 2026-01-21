sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("project1.controller.NewBooking", {

        onInit: function () {
            // Variable initialization
            this._oNavContainer = null;
        },

        onAfterRendering: function() {
            // 1. Get NavContainer Reference
            this._oNavContainer = this.byId("wizardNavContainer");
            
            // 2. Force Navigate to Page 1 (Consignment)
            var oPage1 = this.byId("pageConsignment");
            if(this._oNavContainer && oPage1) {
                this._oNavContainer.to(oPage1);
            }

            // 3. Set Header to Step 1 initially
            this._updateHeader(1);
        },

        // ============================================================
        // INPUT LOGIC (WEIGHT STEPPER)
        // ============================================================
        onIncrement: function () {
            var oInput = this.byId("inputWeight");
            if (!oInput) return;

            var sValue = oInput.getValue();
            var iValue = parseInt(sValue);
            if (isNaN(iValue)) { iValue = 0; }
            if (iValue < 100) { oInput.setValue(iValue + 1); }
        },

        onDecrement: function () {
            var oInput = this.byId("inputWeight");
            if (!oInput) return;

            var sValue = oInput.getValue();
            var iValue = parseInt(sValue);
            if (isNaN(iValue)) { iValue = 0; }
            if (iValue > 1) { oInput.setValue(iValue - 1); }
        },

        // ============================================================
        // NAVIGATION LOGIC (MOVING BETWEEN PAGES)
        // ============================================================
        
        // Step 1 -> Step 2 (Logistics)
        onToLogistics: function() {
            var oPage = this.byId("pageLogistics");
            if (this._oNavContainer && oPage) {
                this._oNavContainer.to(oPage);
                this._updateHeader(2); // Header Update
            }
        },

        // Step 2 -> Step 1
        onBackToConsignment: function() {
            this._oNavContainer.back();
            this._updateHeader(1);
        },

        // Step 2 -> Step 3 (Pricing)
        onToPricing: function() {
            var oPage = this.byId("pagePricing");
            if (this._oNavContainer && oPage) {
                this._oNavContainer.to(oPage);
                this._updateHeader(3); // Header Update
            }
        },

        // Step 3 -> Step 2
        onBackToLogistics: function() {
            this._oNavContainer.back();
            this._updateHeader(2);
        },

        // Step 3 -> Step 4 (Final Review) - FIX ADDED HERE
        onToConfirm: function() {
            var oPage = this.byId("pageConfirm");
            if (this._oNavContainer && oPage) {
                this._oNavContainer.to(oPage);
                this._updateHeader(4); // IMPORTANT: Make Step 4 Active (Purple Gradient)
            }
        },

        // Step 4 -> Step 3
        onBackToPricing: function() {
            this._oNavContainer.back();
            this._updateHeader(3);
        },

        // ============================================================
        // HEADER VISUAL UPDATER (THE CIRCLES)
        // ============================================================
        _updateHeader: function(iStep) {
            // 1. Get references to circles (Make sure XML IDs match these)
            var s1 = this.byId("step1Ind");
            var s2 = this.byId("step2Ind");
            var s3 = this.byId("step3Ind");
            var s4 = this.byId("step4Ind"); // Ensure this ID exists in XML
            
            // Get references to connecting lines (Optional, if you have them)
            var l1 = this.byId("line1");
            var l2 = this.byId("line2");
            var l3 = this.byId("line3");

            if (!s1 || !s2 || !s3 || !s4) {
                return; // Safety check
            }

            // 2. RESET ALL (Clean Slate)
            // Remove Active/Completed classes from everyone
            [s1, s2, s3, s4].forEach(function(s) {
                s.removeStyleClass("stepActive");
                s.removeStyleClass("stepCompleted");
            });

            // Reset Lines
            if(l1) l1.removeStyleClass("stepProgressLine");
            if(l2) l2.removeStyleClass("stepProgressLine");
            if(l3) l3.removeStyleClass("stepProgressLine");

            // 3. APPLY CLASSES BASED ON CURRENT STEP
            switch(iStep) {
                case 1:
                    s1.addStyleClass("stepActive");
                    break;

                case 2:
                    s1.addStyleClass("stepCompleted");
                    if(l1) l1.addStyleClass("stepProgressLine");
                    s2.addStyleClass("stepActive");
                    break;

                case 3:
                    s1.addStyleClass("stepCompleted");
                    s2.addStyleClass("stepCompleted");
                    if(l1) l1.addStyleClass("stepProgressLine");
                    if(l2) l2.addStyleClass("stepProgressLine");
                    s3.addStyleClass("stepActive");
                    break;

                case 4:
                    s1.addStyleClass("stepCompleted");
                    s2.addStyleClass("stepCompleted");
                    s3.addStyleClass("stepCompleted");
                    if(l1) l1.addStyleClass("stepProgressLine");
                    if(l2) l2.addStyleClass("stepProgressLine");
                    if(l3) l3.addStyleClass("stepProgressLine");
                    s4.addStyleClass("stepActive"); // Make Review Circle Gradient Purple
                    break;
            }
        },

        // ============================================================
        // FINAL SUBMISSION
        // ============================================================
        onConfirmDispatch: function () {
            // 1. Show Success Message
            MessageBox.success("Shipment Initiated Successfully!", {
                title: "Dispatch Confirmed",
                onClose: function() {
                    // Optional: Reset to beginning or navigate away
                }
            });

            // 2. VISUAL FIX: Make the 4th Circle "Completed" (Solid Purple)
            var s4 = this.byId("step4Ind");
            if (s4) {
                s4.removeStyleClass("stepActive");
                s4.addStyleClass("stepCompleted"); // Changes Gradient to Solid Color
            }
        }
    });
});