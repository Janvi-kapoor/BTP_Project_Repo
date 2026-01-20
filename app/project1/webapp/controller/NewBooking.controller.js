sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("project1.controller.NewBooking", {
        
        onInit: function () {
            // Wizard initialization logic yahan aayega
        },

        onReviewStepActivate: function() {
            // Jab Review step par aaoge tab ye chalega
        },

        onConfirmBooking: function() {
            // Jab Confirm button dabaoge
            alert("Booking Confirmed!");
        }
    });
});