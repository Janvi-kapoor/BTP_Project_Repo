sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"],
  function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("project1.controller.CustomerDashboard", {
      onInit: function () {
        // 2. Router Attach karna (URL detect karne ke liye)
        var oRouter = this.getOwnerComponent().getRouter();

        // Refresh main model to ensure fresh data
        var oMainModel = this.getOwnerComponent().getModel();
        if (oMainModel && oMainModel.refresh) {
          oMainModel.refresh();
        }

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
          var oEmailFilter = new sap.ui.model.Filter(
            "customer/email",
            sap.ui.model.FilterOperator.EQ,
            sEmail,
          );
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
                "Cancelled",
              ),
            ],
            and: true,
          });

          // Apply filters, Expand relationships, and Force Refresh
          oBinding.filter(
            new sap.ui.model.Filter({
              filters: [oEmailFilter, oStatusFilter],
              and: true,
            }),
          );

          oBinding.changeParameters({ $expand: "customer,assignment" });
          oBinding.refresh(); // Forces backend call even if data exists in cache

          console.log("Recent Shipments Refreshed");
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

        // 2. Email Filter (Security)
        if (sUserEmail) {
          aFinalFilters.push(
            new sap.ui.model.Filter(
              "customer/email",
              sap.ui.model.FilterOperator.EQ,
              sUserEmail,
            ),
          );
        }

        // --- 2.5 ADDED LOGIC: Cancelled aur Delivered ko exclude karna ---
        aFinalFilters.push(
          new sap.ui.model.Filter(
            "status",
            sap.ui.model.FilterOperator.NE,
            "Cancelled",
          ),
        );
        aFinalFilters.push(
          new sap.ui.model.Filter(
            "status",
            sap.ui.model.FilterOperator.NE,
            "Delivered",
          ),
        );
        // -----------------------------------------------------------------

        // 3. Search Filter (Material Category)
        if (sQuery && sQuery.length > 0) {
          var oMaterialFilter = new sap.ui.model.Filter({
            path: "materialCategory",
            operator: sap.ui.model.FilterOperator.Contains,
            value1: sQuery,
            caseSensitive: false,
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
        var oMenuItem = oEvent.getParameter("item");
        var sSelectedKey = oMenuItem.getKey();
        var sSelectedText = oMenuItem.getText();
        var oMenuButton = this.byId("historyFilterMenuButton2");
        var oTable = this.byId("recentShipmentsTable"); // Apni Table ID confirm kar lein
        var oBinding = oTable.getBinding("items");
        var sEmail = window.localStorage.getItem("userEmail");

        if (!oBinding) return;

        var aFinalFilters = [];

        // 1. Permanent Email Filter (Hamesha rahega)
        if (sEmail) {
          aFinalFilters.push(
            new sap.ui.model.Filter(
              "customer/email",
              sap.ui.model.FilterOperator.EQ,
              sEmail,
            ),
          );
        }

        if (sSelectedKey === "All") {
          // --- LOGIC FOR "ALL" ---
          // Isme Delivered aur Cancelled ko hide karna hai
          var aExclusions = [
            "Delivered",
            "Cancelled",
            "DELIVERED",
            "CANCELLED",
          ];
          aExclusions.forEach(function (sStatus) {
            aFinalFilters.push(
              new sap.ui.model.Filter(
                "status",
                sap.ui.model.FilterOperator.NE,
                sStatus,
              ),
            );
          });

          oMenuButton.setText(""); // Reset to icon only
        } else {
          // --- LOGIC FOR SPECIFIC (In-Transit, Pending, ConfirmPickup) ---
          aFinalFilters.push(
            new sap.ui.model.Filter(
              "status",
              sap.ui.model.FilterOperator.EQ,
              sSelectedKey,
            ),
          );

          oMenuButton.setText("Status: " + sSelectedText); // Button par text dikhayega
        }

        // 2. Final Filter Application (AND logic ke saath)
        oBinding.filter(
          new sap.ui.model.Filter({
            filters: aFinalFilters,
            and: true,
          }),
        );

        console.log("Applied Filter for: " + sSelectedKey);
      },
      // Ye function tab chalega jab URL change hoga
      _onRouteMatched: function (oEvent) {
        var sRouteName = oEvent.getParameter("name");
        var oNavContainer = this.byId("pageNavContainer");
        var oSideNav = this.byId("_IDGenSideNavigation");

        if (sRouteName === "CustomerDashboard") {
          // Refresh data every time we enter Dashboard
          this._onObjectMatched();
          oNavContainer.to(this.byId("dashPage"));
          if (oSideNav) oSideNav.setSelectedKey("dash");
        } else if (sRouteName === "CustomerBooking") {
          oNavContainer.to(this.byId("bookingPage"));
          if (oSideNav) oSideNav.setSelectedKey("booking");
        } else if (sRouteName === "CustomerTracking") {
          oNavContainer.to(this.byId("trackPage"));
          if (oSideNav) oSideNav.setSelectedKey("track");
        } else if (sRouteName === "CustomerHistory") {
          oNavContainer.to(this.byId("historyPage"));
          if (oSideNav) oSideNav.setSelectedKey("history");
        }
      },
      _loadDashboardMetrics: function (sEmail) {
        var oModel = this.getOwnerComponent().getModel();
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

      // Handle shipment ID click to navigate to tracking page
      onShipmentIdPress: function (oEvent) {
        var oBindingContext = oEvent.getSource().getBindingContext();
        var sShipmentId = oBindingContext.getProperty("ID");

        console.log("Clicked Shipment ID:", sShipmentId);

        // Save shipment ID to localStorage
        localStorage.setItem("selectedShipmentId", sShipmentId);
        console.log(
          "Saved to localStorage:",
          localStorage.getItem("selectedShipmentId"),
        );

        // Navigate to track page
        var oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("CustomerTracking");
      },

      onLogout: function() {
        // Clear all localStorage data
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userRole");
        localStorage.removeItem("loggedDriverID");
        localStorage.removeItem("loggedDriverName");
        localStorage.removeItem("selectedShipmentId");
        localStorage.clear();
        
        // Navigate to main landing page (3 tiles)
        this.getOwnerComponent().getRouter().navTo("RouteView1");
        
        // Show confirmation message
        sap.m.MessageToast.show("Logged out successfully");
      },

      // Customer Notification System
      onNotificationPress: function() {
        if (!this._notificationPopover) {
          this._notificationPopover = sap.ui.xmlfragment("project1.fragment.NotificationPopover", this);
          this.getView().addDependent(this._notificationPopover);
        }
        
        this._loadCustomerNotifications();
        this._notificationPopover.openBy(this.byId("customerNotificationBtn"));
      },

      _loadCustomerNotifications: function() {
        var sUserEmail = localStorage.getItem("userEmail");
        var oModel = this.getOwnerComponent().getModel();
        var that = this;
        
        // First get customer ID
        var oUserBinding = oModel.bindList("/Users", null, [], [
          new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, sUserEmail)
        ]);
        
        oUserBinding.requestContexts(0, 1).then(function(aUserContexts) {
          if (aUserContexts.length > 0) {
            var sCustomerID = aUserContexts[0].getObject().ID;
            
            // Now get notifications for customer's shipments
            var oDelayBinding = oModel.bindList("/ActiveDelays", null, [], [
              new sap.ui.model.Filter("customerID", sap.ui.model.FilterOperator.EQ, sCustomerID)
            ]);
            
            oDelayBinding.requestContexts().then(function(aContexts) {
              var aNotifications = aContexts.map(function(oContext) {
                return oContext.getObject();
              });
              
              var oNotificationModel = new sap.ui.model.json.JSONModel(aNotifications);
              that.getView().setModel(oNotificationModel, "notificationModel");
              
              // Update notification count
              that._updateNotificationCount(aNotifications.length);
            });
          }
        }).catch(function(oError) {
          console.error("Failed to load customer notifications:", oError.message);
        });
      },

      _updateNotificationCount: function(iCount) {
        var oBtn = this.byId("customerNotificationBtn");
        if (oBtn) {
          if (iCount > 0) {
            oBtn.setText(iCount.toString());
            oBtn.setType("Emphasized");
          } else {
            oBtn.setText("");
            oBtn.setType("Transparent");
          }
        }
      },

      onRefreshNotifications: function() {
        this._loadCustomerNotifications();
      },

      onCloseNotifications: function() {
        this._notificationPopover.close();
      },
    });
  },
);
