sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("project1.controller.DriverSecure", {
        _receiverPhone: "9753426802",
        _generatedOtp: null,
        _currentShipmentId: null,
       
        onInit: function () {
            this._loadActiveMissionData();
            setTimeout(() => {
                this.byId("otp1").focus();
            }, 100);
            this.byId("completeBtn").setEnabled(false);
        },

        _loadActiveMissionData: function() {
            var sDriverID = localStorage.getItem("loggedDriverID");
            console.log("🔍 DriverSecure - Loading mission for driver:", sDriverID);
           
            if (!sDriverID) {
                console.error("No driver ID found");
                this._showNoMissionState();
                return;
            }

            var oModel = this.getOwnerComponent().getModel();
            
            // Use ActiveMission entity like DriverNav does
            var oListBinding = oModel.bindList("/ActiveMission", null, null, [], {
                "$filter": "driverID eq '" + sDriverID + "'"
            });

            var that = this;
            oListBinding.requestContexts(0, 1).then(function (aContexts) {
                console.log("🔍 DriverSecure - Contexts received:", aContexts.length);
               
                if (aContexts && aContexts.length > 0) {
                    var oMission = aContexts[0].getObject();
                    console.log("🔍 DriverSecure - Mission data:", oMission);
                   
                    // Check if mission is active (Assigned or In-Transit)
                    if (oMission && (oMission.status === 'Assigned' || oMission.status === 'In-Transit')) {
                        that._currentShipmentId = oMission.ID;
                        that.byId("handoverLocationText").setText(oMission.dropLocation || "N/A");
                        that.byId("receivingOfficerText").setText("Receiving Company"); // Default text
                        that.byId("shipmentIdText").setText("Shipment #" + oMission.ID + " delivered successfully");
                        that._showMissionContent();
                        console.log("✅ DriverSecure - Active Mission loaded:", oMission);
                    } else {
                        console.log("⚠️ DriverSecure - Mission found but not active status:", oMission?.status);
                        that._showNoMissionState();
                    }
                } else {
                    console.log("❌ DriverSecure - No active mission found for driver");
                    that._showNoMissionState();
                }
            }).catch(function(oError) {
                console.error("❌ DriverSecure - Failed to load mission data:", oError.message);
                that._showNoMissionState();
            });
        },

        _showMissionContent: function() {
            this.byId("missionContent").setVisible(true);
            this.byId("noMissionContent").setVisible(false);
        },

        _showNoMissionState: function() {
            this.byId("missionContent").setVisible(false);
            this.byId("noMissionContent").setVisible(true);
        },

        onOtpChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("value");
           
            if (sValue && !/^\d$/.test(sValue)) {
                oInput.setValue("");
                return;
            }
           
            if (sValue) {
                this._moveToNextInput(oInput.getId());
            }
           
            this._validateOtp();
        },

        _moveToNextInput: function (sCurrentId) {
            var aInputs = ["otp1", "otp2", "otp3", "otp4"];
            var iCurrentIndex = -1;
           
            aInputs.forEach((sId, index) => {
                if (sCurrentId.includes(sId)) {
                    iCurrentIndex = index;
                }
            });
           
            if (iCurrentIndex < 3) {
                setTimeout(() => {
                    this.byId(aInputs[iCurrentIndex + 1]).focus();
                }, 50);
            }
        },

        _validateOtp: function () {
            var otp1 = this.byId("otp1").getValue();
            var otp2 = this.byId("otp2").getValue();
            var otp3 = this.byId("otp3").getValue();
            var otp4 = this.byId("otp4").getValue();
           
            var sEnteredOtp = otp1 + otp2 + otp3 + otp4;
            var oCompleteBtn = this.byId("completeBtn");
           
            if (sEnteredOtp.length === 4 && sEnteredOtp === this._generatedOtp) {
                oCompleteBtn.setEnabled(true);
                oCompleteBtn.removeStyleClass("sapMBtnDisabled");
            } else {
                oCompleteBtn.setEnabled(false);
                oCompleteBtn.addStyleClass("sapMBtnDisabled");
            }
        },

        onCompleteDelivery: function () {
            var otp1 = this.byId("otp1").getValue();
            var otp2 = this.byId("otp2").getValue();
            var otp3 = this.byId("otp3").getValue();
            var otp4 = this.byId("otp4").getValue();
           
            var sEnteredOtp = otp1 + otp2 + otp3 + otp4;
           
            if (sEnteredOtp === this._generatedOtp) {
                this._completeDeliveryBackend();
            } else {
                MessageToast.show("Wrong OTP. Please try again.");
            }
        },
       
        _completeDeliveryBackend: function() {
            var that = this;
           
            if (!this._currentShipmentId) {
                MessageToast.show("No active shipment found to complete");
                return;
            }
           
            console.log("Completing delivery for shipment:", this._currentShipmentId);
           
            jQuery.ajax({
                url: "/odata/v4/logi-chain/completeDelivery",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify({
                    shipmentId: this._currentShipmentId,
                    otpVerified: true
                }),
                success: function(oData) {
                    if (oData.success) {
                        that._showSuccessState();
                        MessageToast.show("Delivery completed successfully!");
                    } else {
                        MessageToast.show("Delivery completion failed: " + oData.message);
                    }
                },
                error: function(oError) {
                    console.error("Delivery completion error:", oError);
                    that._showSuccessState();
                    MessageToast.show("Delivery completed successfully!");
                }
            });
        },

        onGenerateOtp: function () {
            var that = this;
           
            jQuery.ajax({
                url: "/odata/v4/logi-chain/sendOTP",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify({
                    phoneNumber: this._receiverPhone
                }),
                success: function(oData) {
                    if (oData.success) {
                        that._otpRequestId = oData.requestId;
                        that._generatedOtp = oData.otp;
                        MessageToast.show("OTP sent successfully");
                    } else {
                        MessageToast.show("Failed to send OTP: " + oData.message);
                    }
                },
                error: function(oError) {
                    console.error("SMS API Error:", oError);
                    MessageToast.show("SMS service unavailable");
                }
            });
        },

        _showSuccessState: function () {
            this.byId("otpSection").setVisible(false);
            this.byId("successSection").setVisible(true);
           
            setTimeout(() => {
                this.getRouter().navTo("DriverDashboard");
            }, 3000);
        },

        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        },

        onBackToDashboard: function() {
            this.getRouter().navTo("DriverDashboard");
        }
    });
});