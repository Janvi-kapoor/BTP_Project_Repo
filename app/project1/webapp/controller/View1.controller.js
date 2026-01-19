sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("com.logichain.controller.Entry", {
        onInit: function () {
            // Mobile status bar color control (optional)
            if (sap.ui.Device.os.name === "iOS" || sap.ui.Device.os.name === "Android") {
                // Logic for mobile devices
            }
        },

        onLaunchWorkspace: function (oEvent) {
            var sPortal = oEvent.getSource().getParent().getMetadata().getName();
            sap.m.MessageToast.show("Launching Portal...");
        }
    });
});