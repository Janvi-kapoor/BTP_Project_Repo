sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/FilterOperator"
  ],
  function (Controller, JSONModel, Filter, FilterOperator, Spreadsheet) {
    "use strict";
    return Controller.extend("project1.controller.OrderHistory", {
      onInit: function () {
        console.log("!!! OrderHistory Controller Loaded Successfully !!!");
        
        // Immediately load data when controller initializes
        var sUserEmail = localStorage.getItem("userEmail");
        if (sUserEmail) {
          console.log("Loading history data for:", sUserEmail);
          this._loadHistoryShipments(sUserEmail);
        }

        // Router setup
        var oRouter = this.getOwnerComponent().getRouter();
        oRouter.attachRouteMatched(this._onRouteMatched, this);
      },
      _onRouteMatched: function (oEvent) {
        var sRouteName = oEvent.getParameter("name");
        console.log("Matched Route:", sRouteName);


        // Sirf tab load karein jab hum History page par hon
        if (sRouteName === "CustomerHistory") {
          var sUserEmail = localStorage.getItem("userEmail");
          console.log("Loading data for:", sUserEmail);
          this._loadHistoryShipments(sUserEmail);
        }
      },

      _loadHistoryShipments: function (sEmail) {
        var oView = this.getView();
        var oModel = this.getOwnerComponent().getModel();


        // 1. Status Filter Group (Delivered OR Cancelled)
        var oStatusFilter = new sap.ui.model.Filter({
          filters: [
            new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "Delivered"),
            new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "Cancelled"),
            new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "DELIVERED"),
            new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "CANCELLED")
          ],
          and: false // 'false' is for OR logic
        });


        // 2. Email Filter
        var oEmailFilter = new sap.ui.model.Filter("customer/email", sap.ui.model.FilterOperator.EQ, sEmail);


        // 3. Final Combined Filter (Email AND Status Group)
        var oFinalFilter = new sap.ui.model.Filter({
          filters: [oEmailFilter, oStatusFilter],
          and: true // 'true' is for AND logic
        });


        // Manual List Binding with Expanded Filters
        var oListBinding = oModel.bindList("/AdminShipments", null, null, [oFinalFilter], {
          "$expand": "customer"
        });


        // Request trigger karne ke liye
        oListBinding.requestContexts().then(function (aContexts) {
          console.log("Backend se filtered data aa gaya! Count:", aContexts.length);


          var aData = aContexts.map(function(oCtx) {
            var oData = oCtx.getObject();
            // Format totalFare with Indian number formatting
            if (oData.totalFare) {
              oData.totalFare = parseFloat(oData.totalFare).toLocaleString("en-IN");
            }
            return oData;
          });
          var oJsonModel = new sap.ui.model.json.JSONModel(aData);
          oView.setModel(oJsonModel, "historyModel");


          // Table ki items binding update karein
          var oTable = this.byId("historyShipmentsTable");
          var oBindingInfo = oTable.getBindingInfo("items");


          if (oBindingInfo && oBindingInfo.template) {
            oTable.bindItems({
              path: "historyModel>/",
              template: oBindingInfo.template
            });
          }


        }.bind(this)).catch(function (oError) {
          console.error("Data fetch error:", oError);
        });
      },
      formatRoute: function (sPickup, sDrop) {
        if (sPickup && sDrop) {
          return sPickup + " → " + sDrop;
        } else if (sPickup || sDrop) {
          return sPickup || sDrop;
        }
        return "";
      },
      formatStatusState: function (sStatus) {
        if (!sStatus) return "None";
        switch (sStatus.toUpperCase()) {
          case "DELIVERED":
            return "Success"; // Ye Green color dega
          case "CANCELLED":
            return "Error";   // Ye Red color dega
          default:
            return "None";    // Default Gray
        }
      },

      onStatusFilterChange: function (oEvent) {
        var oMenuItem = oEvent.getParameter("item");
        var sSelectedKey = oMenuItem.getKey();
        var oMenuButton = this.byId("historyFilterMenuButton");
        if (sSelectedKey === "All") {
          this._applyHistoryDefaultFilter();
          oMenuButton.setText("Status: Show All");
        } else {
          // Specific Status Filter (Delivered ya Cancelled)
          var oBinding = this.byId("historyShipmentsTable").getBinding("items");
          var sEmail = window.localStorage.getItem("userEmail");


          var aFilters = [
            new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, sSelectedKey),
            new sap.ui.model.Filter("customer/email", sap.ui.model.FilterOperator.EQ, sEmail)
          ];


          oBinding.filter(aFilters);
          oMenuButton.setText("Status: " + sSelectedKey);
        }
      },
      onHistorySearch: function (oEvent) {
        var sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue");
        var oTable = this.byId("historyShipmentsTable");
        var oBinding = oTable.getBinding("items");
        var aFinalFilters = [];


        // 1. Agar search box mein kuch likha hai
        if (sQuery && sQuery.length > 0) {
          var oSearchFilter = new sap.ui.model.Filter({
            filters: [
              new sap.ui.model.Filter("ID", sap.ui.model.FilterOperator.Contains, sQuery),
              new sap.ui.model.Filter("pickupLocation", sap.ui.model.FilterOperator.Contains, sQuery),
              new sap.ui.model.Filter("dropLocation", sap.ui.model.FilterOperator.Contains, sQuery)
            ],
            and: false // 'false' matlab OR logic (ID mein ho YA Origin mein YA Destination mein)
          });
          aFinalFilters.push(oSearchFilter);
        }


        // 2. Email Filter hamesha lagna chahiye (Security ke liye)
        var sEmail = window.localStorage.getItem("userEmail");
        if (sEmail) {
          aFinalFilters.push(new sap.ui.model.Filter("customer/email", sap.ui.model.FilterOperator.EQ, sEmail));
        }


        // 3. Status Filter (Delivered/Cancelled wala purana filter)
        // Agar aapne koi variable mein current status store kiya hai toh use yahan add karein


        oBinding.filter(aFinalFilters);
      },
      onExportExcel: function () {
        var oTable = this.byId("historyShipmentsTable");
        var oRowBinding = oTable.getBinding("items");
        var aCols = this._createColumnConfig(); // Columns define karne ke liye niche wala function


        var oSettings = {
          workbook: { columns: aCols },
          dataSource: oRowBinding,
          fileName: "Shipment_History_" + new Date().toLocaleDateString() + ".xlsx",
          worker: false // Chote data ke liye false rakhein
        };


        var oSheet = new sap.ui.export.Spreadsheet(oSettings);
        oSheet.build().finally(function () {
          oSheet.destroy();
        });
      },
      _createColumnConfig: function () {
        return [
          { label: 'Order ID', property: 'ID', type: 'string' },
          { label: 'Date', property: 'createdAt', type: 'date' },
          { label: 'Origin', property: 'pickupLocation', type: 'string' },
          { label: 'Destination', property: 'dropLocation', type: 'string' },
          { label: 'Weight (MT)', property: 'loadWeightTons', type: 'number' },
          { label: 'Amount', property: 'totalFare', type: 'string' },
          { label: 'Status', property: 'status', type: 'string' }
        ];
      },
      _applyHistoryDefaultFilter: function () {
        var oTable = this.byId("historyShipmentsTable");
        var oBinding = oTable.getBinding("items");


        if (oBinding) {
          var sEmail = window.localStorage.getItem("userEmail");


          // 1. Status Filter (Delivered OR Cancelled)
          var oStatusFilter = new sap.ui.model.Filter({
            filters: [
              new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "Delivered"),
              new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "Cancelled")
            ],
            and: false // 'false' matlab OR logic
          });


          var aFilters = [oStatusFilter];


          // 2. Email Filter (Security)
          if (sEmail) {
            aFilters.push(new sap.ui.model.Filter("customer/email", sap.ui.model.FilterOperator.EQ, sEmail));
          }


          oBinding.filter(aFilters);


          // Button ka text bhi update kar dete hain default ke liye
          this.byId("historyFilterMenuButton").setText("Status: Show All");
        }
      }
    });
  });
