sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("project1.controller.SmartDispatcher", {

        /**
         * Helper function to determine the color state of the priority badge
         * Error gayab karne ke liye ye function zaroori hai.
         */
        formatPriority: function (sPriority) {
            if (!sPriority) return "None";
            switch (sPriority) {
                case "Urgent":
                case "High":
                    return "Error"; // Red color
                case "Express":
                case "Medium":
                    return "Warning"; // Orange color
                case "Standard":
                    return "Success"; // Green color
                default:
                    return "None";
            }
        },

        onOrderSelect: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext().getObject();

            // 1. Header Details
            this.byId("selectedOrderId").setText("Order: " + oContext.ID);
            this.byId("selectedOrderDetails").setText("Fare: " + oContext.totalFare + " INR");

            // 2. Requirement Section update
            this.byId("reqMaterial").setText("Material: " + oContext.materialCategory + " (" + oContext.loadWeightTons + " Tons)");
            this.byId("reqVehicle").setText("Required Truck: " + (oContext.requiredVehicleType || "Any Type"));

            // 3. Route Section
            this.byId("reqRoute").setText(oContext.pickupLocation + " ➔ " + oContext.dropLocation);

            // 4. Priority Badge (Yahan 'this.formatPriority' ab error nahi dega)
            var sPriority = oContext.priority;
            var oPriorityBadge = this.byId("selectedPriority");
            if (oPriorityBadge) {
                oPriorityBadge.setText(sPriority);
                oPriorityBadge.setState(this.formatPriority(sPriority));
            }

            // 5. Panels Toggle
            this.byId("emptyState").setVisible(false);
            this.byId("detailsPanel").setVisible(true);

            // --- Smart Filtering: Truck Matcher dropdown filter ---
            // Wahi trucks dikhenge jo weight utha sakein aur type match karein
          // onOrderSelect ke andar filtering wala part aise update karein
var oTruckSelect = this.byId("truckSelect");
if (oTruckSelect && oContext.requiredVehicleType) { // Check agar requirement exist karti hai
    var oTruckBinding = oTruckSelect.getBinding("items");
    var aFilters = [
        new Filter("vehicleType", FilterOperator.EQ, oContext.requiredVehicleType),
        new Filter("maxCapacityTons", FilterOperator.GE, oContext.loadWeightTons)
    ];
    oTruckBinding.filter(aFilters);
} else if (oTruckSelect) {
    // Agar requirement nahi hai, toh saare available trucks dikhao
    oTruckSelect.getBinding("items").filter([]);
}
        },

        onConfirmDispatch: function () {
            var oView = this.getView();
            var oList = this.byId("ordersList");
            var oSelectedItem = oList.getSelectedItem();

            if (!oSelectedItem) {
                MessageToast.show("Please select an order first!");
                return;
            }

            // Get IDs for assignment
            var sOrderID = oSelectedItem.getBindingContext().getProperty("ID");
            var sTruckID = this.byId("truckSelect").getSelectedKey();
            var sDriverID = this.byId("driverSelect").getSelectedKey();

            // Check availability and show notification option
            this._checkAvailabilityAndNotify(sOrderID, sTruckID, sDriverID);
        },
        
        _checkAvailabilityAndNotify: function(sOrderID, sTruckID, sDriverID) {
            var bDriverAvailable = !!sDriverID;
            var bTruckAvailable = !!sTruckID;
            
            if (bDriverAvailable && bTruckAvailable) {
                // Both available - proceed with dispatch
                this._proceedWithDispatch(sOrderID, sTruckID, sDriverID);
            } else {
                // Show unavailability notification
                this._showUnavailabilityNotification(bDriverAvailable, bTruckAvailable, sOrderID);
            }
        },
        
        _showUnavailabilityNotification: function(bDriverAvailable, bTruckAvailable, sOrderID) {
            var sMessage = "";
            var sNotificationType = "";
            
            if (!bDriverAvailable && !bTruckAvailable) {
                sMessage = "No drivers or trucks are currently available for this shipment.";
                sNotificationType = "NoBoth";
            } else if (!bDriverAvailable) {
                sMessage = "No drivers are currently available for this shipment.";
                sNotificationType = "NoDriver";
            } else if (!bTruckAvailable) {
                sMessage = "No trucks are currently available for this shipment.";
                sNotificationType = "NoTruck";
            }
            
            // Store for notification
            this._currentNotification = {
                shipmentID: sOrderID,
                message: sMessage,
                type: sNotificationType
            };
            
            // Show notification UI
            this.byId("unavailabilityMessage").setText(sMessage);
            this.byId("unavailabilitySection").setVisible(true);
        },
        
        _proceedWithDispatch: function(sOrderID, sTruckID, sDriverID) {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel();
            var oOperation = oModel.bindContext("/assignOrder(...)");

            oOperation.setParameter("orderID", sOrderID);
            oOperation.setParameter("truckID", sTruckID);
            oOperation.setParameter("driverID", sDriverID);

            oView.setBusy(true);
            oOperation.execute().then(function () {
                oView.setBusy(false);
                MessageToast.show("Order Dispatched Successfully!");
                this._resetDispatcherView();
            }.bind(this)).catch(function (oError) {
                oView.setBusy(false);
                console.error(oError);
                MessageToast.show("Error: " + (oError.message || "Dispatch failed"));
            });
        },
        
        onNotifyCustomer: function() {
            var that = this;
            if (!this._currentNotification) {
                MessageToast.show("No notification data available");
                return;
            }
            
            var oModel = this.getOwnerComponent().getModel();
            var oOperation = oModel.bindContext("/notifyCustomerUnavailability(...)");
            
            oOperation.setParameter("shipmentID", this._currentNotification.shipmentID);
            oOperation.setParameter("notificationType", this._currentNotification.type);
            oOperation.setParameter("message", this._currentNotification.message);
            
            this.getView().setBusy(true);
            oOperation.execute().then(function() {
                that.getView().setBusy(false);
                MessageToast.show("Customer notified successfully!");
                that._resetDispatcherView();
            }).catch(function(oError) {
                that.getView().setBusy(false);
                console.error("Error notifying customer:", oError);
                MessageToast.show("Error notifying customer");
            });
        },
        
        _resetDispatcherView: function() {
            var oList = this.byId("ordersList");
            
            // Refresh list
            oList.getBinding("items").refresh();
            
            // Reset panels
            this.byId("detailsPanel").setVisible(false);
            this.byId("emptyState").setVisible(true);
            this.byId("unavailabilitySection").setVisible(false);
            
            // Clear selections
            oList.removeSelections();
            this.byId("truckSelect").setSelectedKey("");
            this.byId("driverSelect").setSelectedKey("");
            
            // Clear notification data
            this._currentNotification = null;
        }
    });
});