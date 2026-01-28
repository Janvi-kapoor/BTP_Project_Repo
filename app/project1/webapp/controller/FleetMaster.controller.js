sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, Fragment, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("project1.controller.FleetMaster", {
        onInit: function () {
            // Default model auto-binded from manifest
        },
        

        // 1. Popup Kholne ka Function
        onAddDriver: function () {
            var oView = this.getView();

            // Ek naya local model banate hain temporary data ke liye
            var oNewDriverModel = new JSONModel({
                name: "",
                licenseNo: "",
                rating: 5,
                status: "AVAILABLE"
            });
            oView.setModel(oNewDriverModel, "newDriver");

            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "project1.view.fragments.AddDriver",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pDialog.then(function(oDialog) {
                oDialog.open();
            });
        },

        // 2. Cancel Button ka Function
        onCancelDriver: function () {
            this.byId("addDriverDialog").close();
        },

        // 3. Save Button (Actual OData Create)
        onSaveDriver: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel(); // OData V4 Model
            var oNewDriverData = oView.getModel("newDriver").getData();

            // Validation
            if (!oNewDriverData.name || !oNewDriverData.licenseNo) {
                MessageToast.show("Please fill mandatory fields!");
                return;
            }

            // OData V4 List Binding se connect karna
            // Ensure karein ki Table ki ID "driversTable" ho XML mein
            var oListBinding = this.byId("_IDGenTable").getBinding("items");

            // Data insert karna
            var oContext = oListBinding.create(oNewDriverData);

            oContext.created().then(function () {
                MessageToast.show("Driver Added Successfully!");
                oView.byId("addDriverDialog").close();
            }).catch(function (oError) {
                MessageToast.show("Error: " + oError.message);
            });
        },


        // 1. Truck Popup kholne ke liye
onAddTruck: function () {
    var oView = this.getView();
    var oNewTruckModel = new JSONModel({
        truckNo: "",
        vehicleType: "Heavy Duty",
        maxCapacityTons: 10,
        odometerKM: 0,
        status: "AVAILABLE"
    });
    oView.setModel(oNewTruckModel, "newTruck");

    if (!this._pTruckDialog) {
        this._pTruckDialog = Fragment.load({
            id: oView.getId(),
            name: "project1.view.fragments.AddTruck",
            controller: this
        }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
        });
    }
    this._pTruckDialog.then(function(oDialog) {
        oDialog.open();
    });
},
// Formatter to convert "Vikram Singh" -> "VS"
        formatInitials: function(sFullName) {
            if (!sFullName) {
                return "?";
            }

            // Split name by spaces and remove empty strings
            var aParts = sFullName.trim().split(/\s+/);
            var sInitials = "";

            if (aParts.length > 0) {
                // First letter of first name
                sInitials += aParts[0].charAt(0).toUpperCase();
                
                if (aParts.length > 1) {
                    // First letter of last name
                    sInitials += aParts[aParts.length - 1].charAt(0).toUpperCase();
                }
            }
            
            return sInitials;
        },

// 2. Truck Save karne ke liye
onSaveTruck: function () {
    var oView = this.getView();
    var oTable = this.byId("_IDGenTable1"); // <--- Truck waali Table ki sahi ID check kar lena
    var oListBinding = oTable.getBinding("items");
    var oNewTruckData = oView.getModel("newTruck").getData();

    var oContext = oListBinding.create({
        "truckNo": oNewTruckData.truckNo,
        "vehicleType": oNewTruckData.vehicleType,
        "maxCapacityTons": parseFloat(oNewTruckData.maxCapacityTons),
        "odometerKM": parseFloat(oNewTruckData.odometerKM),
        "status": oNewTruckData.status
    });

    oView.setBusy(true);
    oContext.created().then(function () {
        oView.setBusy(false);
        sap.m.MessageToast.show("Truck Added Successfully!");
        this.byId("addTruckDialog").close();
    }.bind(this)).catch(function (oError) {
        oView.setBusy(false);
        sap.m.MessageToast.show("Error: " + oError.message);
    });
},

onCancelTruck: function () {
    this.byId("addTruckDialog").close();
}
    });
    
});