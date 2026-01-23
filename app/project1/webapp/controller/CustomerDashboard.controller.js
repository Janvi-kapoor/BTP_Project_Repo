sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"],
  function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("project1.controller.CustomerDashboard", {
      onInit: function () {
        // 2. Router Attach karna (URL detect karne ke liye)
        var oRouter = this.getOwnerComponent().getRouter();

        // In chaaro routes par nazar rakho
        oRouter
          .getRoute("CustomerDashboard")
          .attachMatched(this._onRouteMatched, this);
        oRouter
          .getRoute("CustomerBooking")
          .attachMatched(this._onRouteMatched, this);
        oRouter
          .getRoute("CustomerTracking")
          .attachMatched(this._onRouteMatched, this);
        oRouter
          .getRoute("CustomerHistory")
          .attachMatched(this._onRouteMatched, this);
      },
      // CustomerDashboard.controller.js

      _onObjectMatched: function () {
        var sUserEmail = localStorage.getItem("userEmail"); // dist.ops@hul.com
        var oModel = this.getOwnerComponent().getModel();

        var sPath = "/Users('" + sUserEmail + "')"; // Agar Email Key hai toh
        // Agar Email Key nahi hai, toh filter aise hi rahega:
        var oListBinding = oModel.bindList(
          "/Users",
          null,
          [],
          [
            new sap.ui.model.Filter(
              "email",
              sap.ui.model.FilterOperator.EQ,
              sUserEmail,
            ),
          ],
        );

        oListBinding.requestContexts(0, 1).then(
          function (aContexts) {
            if (aContexts.length > 0) {
              var oUserData = aContexts[0].getObject();
              console.log("SUCCESS: Client Found -> " + oUserData.email);

              this.getView().setBindingContext(aContexts[0]);
              this._loadDashboardMetrics(oUserData.email);
              this._loadCustomerShipments(oUserData.email);
            }
          }.bind(this),
        );
      },
      // CustomerDashboard.controller.js

      _loadCustomerShipments: function (sEmail) {
        var oTable = this.byId("recentShipmentsTable");
        var oBinding = oTable.getBinding("items");

        if (oBinding) {
          // 1. Email Filter
          var oEmailFilter = new sap.ui.model.Filter(
            "customer/email",
            sap.ui.model.FilterOperator.EQ,
            sEmail,
          );

          // 2. Status Filter (Delivered aur Cancelled ko hatane ke liye)
          // Dhyan dein: Agar database mein status CAPITAL hai toh yahan bhi CAPITAL likhen
          var oStatusFilter = new sap.ui.model.Filter({
            filters: [
              new sap.ui.model.Filter(
                "status",
                sap.ui.model.FilterOperator.NE,
                "Delivered",
              ),
              new sap.ui.model.Filter(
                "status",
                sap.ui.model.FilterOperator.NE,
                "DELIVERED",
              ),
              new sap.ui.model.Filter(
                "status",
                sap.ui.model.FilterOperator.NE,
                "Cancelled",
              ),
              new sap.ui.model.Filter(
                "status",
                sap.ui.model.FilterOperator.NE,
                "CANCELLED",
              ),
            ],
            and: true, // Saari conditions match honi chahiye (Neither Delivered NOR Cancelled)
          });

          // 3. Dono ko merge karein
          var oFinalFilter = new sap.ui.model.Filter({
            filters: [oEmailFilter, oStatusFilter],
            and: true,
          });

          oBinding.filter(oFinalFilter);

          // Expand lagana zaroori hai
          oBinding.changeParameters({ $expand: "customer,assignment" });

          console.log("Final Filters Applied Successfully");
        }
      },
      onHistorySearch: function (oEvent) {
        // 1. Value nikalna (newValue liveChange se aata hai)
        var sQuery =
          oEvent.getParameter("newValue") || oEvent.getParameter("query");
        var sUserEmail = localStorage.getItem("userEmail");

        var oTable = this.byId("recentShipmentsTable");
        var oBinding = oTable.getBinding("items");

        if (!oBinding) return;

        var aFinalFilters = [];

        // 2. Email Filter (Security) - Aapke screenshot mein logistics@ril.com dikh raha hai
        if (sUserEmail) {
          aFinalFilters.push(
            new sap.ui.model.Filter(
              "customer/email",
              sap.ui.model.FilterOperator.EQ,
              sUserEmail,
            ),
          );
        }

        // 3. Search Filter (Material Category)
        if (sQuery && sQuery.length > 0) {
          var oMaterialFilter = new sap.ui.model.Filter({
            path: "materialCategory", // Agar error aaye toh yahan check karein ki 'material' hai ya 'materialCategory'
            operator: sap.ui.model.FilterOperator.Contains,
            value1: sQuery,
            caseSensitive: false, // 'Consumer' ya 'consumer' dono match honge
          });
          aFinalFilters.push(oMaterialFilter);
        }

        // 4. Sabhi filters ko AND logic ke sath apply karein
        oBinding.filter(
          new sap.ui.model.Filter({
            filters: aFinalFilters,
            and: true,
          }),
        );

        // Navigation properties load karne ke liye
        oBinding.changeParameters({ $expand: "customer,assignment" });
      },
      onStatusFilterChange: function (oEvent) {
        var sUserEmail = localStorage.getItem("userEmail"); // Local storage se email
        var oMenuItem = oEvent.getParameter("item"),
          sSelectedKey = oMenuItem.getKey(),
          oTable = this.byId("recentShipmentsTable"),
          oBinding = oTable.getBinding("items");

        if (!oBinding) return;

        var aFinalFilters = [];

        // 1. Permanent Email Filter (Navigation path use karke: customer/email)
        if (sUserEmail) {
          aFinalFilters.push(
            new sap.ui.model.Filter(
              "customer/email",
              sap.ui.model.FilterOperator.EQ,
              sUserEmail,
            ),
          );
        }

        // 2. Status Logic
        if (sSelectedKey === "All") {
          // All select karne par Delivered/Cancelled ko hide karne ka logic
          var oExclusionFilter = new sap.ui.model.Filter({
            filters: [
              new sap.ui.model.Filter(
                "status",
                sap.ui.model.FilterOperator.NE,
                "Delivered",
              ),
              new sap.ui.model.Filter(
                "status",
                sap.ui.model.FilterOperator.NE,
                "DELIVERED",
              ),
              new sap.ui.model.Filter(
                "status",
                sap.ui.model.FilterOperator.NE,
                "Cancelled",
              ),
              new sap.ui.model.Filter(
                "status",
                sap.ui.model.FilterOperator.NE,
                "CANCELLED",
              ),
            ],
            and: true,
          });
          aFinalFilters.push(oExclusionFilter);
        } else {
          // Specific status (In-Transit, Pending) ke liye
          aFinalFilters.push(
            new sap.ui.model.Filter(
              "status",
              sap.ui.model.FilterOperator.EQ,
              sSelectedKey,
            ),
          );
        }

        // 3. Filter Apply karein (Email AND Status)
        oBinding.filter(
          new sap.ui.model.Filter({
            filters: aFinalFilters,
            and: true,
          }),
        );

        // 4. Expand parameters taaki customer ka data load ho sake
        oBinding.changeParameters({ $expand: "customer,assignment" });

        console.log("Filter applied for: " + sSelectedKey);
      },
      // Ye function tab chalega jab URL change hoga
      _onRouteMatched: function (oEvent) {
        var sRouteName = oEvent.getParameter("name");
        var oNavContainer = this.byId("pageNavContainer");
        var oSideNav = this.byId("_IDGenSideNavigation");
        if (sRouteName === "CustomerDashboard") {
          this._onObjectMatched();
        }
        // URL check karke sahi page dikhao
        if (sRouteName === "CustomerBooking") {
          oNavContainer.to(this.byId("bookingPage"));
          oSideNav.setSelectedKey("booking"); // Sidebar button highlight karo
        } else if (sRouteName === "CustomerTracking") {
          oNavContainer.to(this.byId("trackPage"));
          oSideNav.setSelectedKey("track");
        } else if (sRouteName === "CustomerHistory") {
          oNavContainer.to(this.byId("historyPage"));
          oSideNav.setSelectedKey("history");
        } else {
          // Default: Dashboard
          oNavContainer.to(this.byId("dashPage"));
          oSideNav.setSelectedKey("dash");
        }
      },
      _loadDashboardMetrics: function (sEmail) {
        var oModel = this.getOwnerComponent().getModel();
        console.log("fhir error kyu " + sEmail);
        // OData V4 mein functions ke liye binding parameters zaroori hote hain
        var oContextBinding = oModel.bindContext(
          "/getDashboardMetrics(...)",
          null,
          {
            userEmail: sEmail,
          },
        );

        // Ab execute call karein
        oContextBinding
          .execute()
          .then(
            function () {
              var oData = oContextBinding.getBoundContext().getObject();

              // JSON Model mein data set karein
              var oMetricsModel = new sap.ui.model.json.JSONModel({
                active: oData.activeShipments || 0,
                pending: oData.pendingDispatch || 0,
                spend: oData.monthlySpend || 0,
              });

              this.getView().setModel(oMetricsModel, "metrics");
              console.log("Metrics data successfully loaded!");
            }.bind(this),
          )
          .catch(function (oError) {
            console.error("Metrics load failed:", oError);
          });
      },

      // Sidebar Menu Button Toggle
      onSideNavButtonPress: function () {
        var oToolPage = this.byId("toolPage");
        oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
      },

      // Jab user Sidebar Item par Click kare
      onItemSelect: function (oEvent) {
        var sKey = oEvent.getParameter("item").getKey();
        var oRouter = this.getOwnerComponent().getRouter();

        // Yahan hum page change nahi karenge, hum sirf URL badlenge.
        // URL badalne par _onRouteMatched chalega aur wo page badlega.

        if (sKey === "booking") {
          oRouter.navTo("CustomerBooking");
        } else if (sKey === "track") {
          oRouter.navTo("CustomerTracking");
        } else if (sKey === "history") {
          oRouter.navTo("CustomerHistory");
        } else {
          oRouter.navTo("CustomerDashboard");
        }
      },
    });
  },
);
