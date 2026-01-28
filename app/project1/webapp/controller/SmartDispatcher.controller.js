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
            this.byId("reqVehicle").setText("Required Truck: " + oContext.requiredVehicleType);

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

            if (!sTruckID || !sDriverID) {
                MessageToast.show("Please select both Truck and Driver!");
                return;
            }

            // Backend Action Call (OData V4)
            var oModel = this.getOwnerComponent().getModel();
            var oOperation = oModel.bindContext("/assignOrder(...)");

            oOperation.setParameter("orderID", sOrderID);
            oOperation.setParameter("truckID", sTruckID);
            oOperation.setParameter("driverID", sDriverID);

            oView.setBusy(true);
            oOperation.execute().then(function () {
                oView.setBusy(false);
                MessageToast.show("Order Dispatched Successfully!");

                // Refresh list: Order list se apne aap gayab hona chahiye
                oList.getBinding("items").refresh();
            }).catch(function (oError) {
                oView.setBusy(false);
                console.error(oError);
                MessageToast.show("Error: " + oError.message);
            });
        }
    });
});