sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/Device",
    "sap/ui/core/UIComponent"
], function (Controller, Device, UIComponent) {
    "use strict";

    return Controller.extend("project1.controller.AdminDashboard", {

        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("AdminDashboard").attachPatternMatched(this._onAdminMatched, this);

            // Refresh main model to ensure fresh data
            var oMainModel = this.getOwnerComponent().getModel();
            if (oMainModel && oMainModel.refresh) {
                oMainModel.refresh();
            }

            if (Device.system.phone) {
                var oToolPage = this.byId("adminToolPage");
                if (oToolPage) {
                    oToolPage.setSideExpanded(false);
                }
            }
            
            // Load notifications initially
            setTimeout(function() {
                this._loadNotifications();
            }.bind(this), 1000);
            
            // Set up periodic notification refresh (every 30 seconds)
            this._notificationTimer = setInterval(function() {
                if (this._loadNotifications) {
                    this._loadNotifications();
                }
            }.bind(this), 30000);
        },
        
        onAfterRendering: function() {
            var oBtn = this.byId("sideNavBtn2");
            var that = this;

            if (oBtn) {
                oBtn.$().off("tap click touchstart");
                oBtn.attachBrowserEvent("click touchstart", function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    that.onSideNavButtonPress();
                });
            }
            
            this._loadUserProfile();
        },
        
        _loadUserProfile: function() {
            var sUserEmail = localStorage.getItem("userEmail");
            if (sUserEmail) {
                var oModel = this.getOwnerComponent().getModel();
                var oListBinding = oModel.bindList("/Users", null, [], [
                    new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, sUserEmail)
                ]);

                oListBinding.requestContexts(0, 1).then(function (aContexts) {
                    if (aContexts.length > 0) {
                        var oUserData = aContexts[0].getObject();
                        var oCompanyText = this.byId("_IDGuenText18");
                        var oEmailText = this.byId("_IDGuenText19");
                        
                        if (oCompanyText && oEmailText) {
                            oCompanyText.setText(oUserData.companyName || "Admin User");
                            oEmailText.setText(oUserData.email || "admin@company.com");
                        }
                    }
                }.bind(this));
            }
        },

        _onAdminMatched: function () {
            // Default page load
            this.getOwnerComponent().getRouter().navTo("ControlTower");
        },

        // 🟢 NAVIGATION LOGIC (Yeh tumhara main logic hai)
        onItemSelect: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oToolPage = this.byId("adminToolPage");
            
            // Desktop: Agar sidebar band hai to pehle expand karo
            if (!Device.system.phone && window.innerWidth >= 600) {
                if (!oToolPage.getSideExpanded()) {
                    oToolPage.setSideExpanded(true);
                }
            }
            
            // Mobile Optimization: Item click karte hi Sidebar band hona chahiye
            if (Device.system.phone || window.innerWidth < 600) {
                var $sideNav = this.byId("_IDGenSideNavigation1").$();
                
                // Sidebar class hatao (Band karo)
                $sideNav.removeClass("mobile-open");
                
                // Button wapas 'Menu' icon ban jaye
                this.byId("sideNavBtn2").setIcon("sap-icon://menu2");
            }
            

            // Page Navigation (Ye logic safe hai)
            if (sKey) {
                this.getOwnerComponent().getRouter().navTo(sKey);
            }
        },

        // 🟢 TOGGLE LOGIC (Jo tumne abhi fix kiya)
        onSideNavButtonPress: function () {
            var oBtn = this.byId("sideNavBtn2");
            var oSideNav = this.byId("_IDGenSideNavigation1");
            var $sideNav = oSideNav.$(); // jQuery Access

            // Mobile Specific Logic
            if (sap.ui.Device.system.phone || window.innerWidth < 600) {
                
                // Check karo agar class already lagi hai
                if ($sideNav.hasClass("mobile-open")) {
                    // Agar khula hai -> Band karo
                    $sideNav.removeClass("mobile-open");
                    oBtn.setIcon("sap-icon://menu2"); // Menu Icon wapas lao
                } else {
                    // Agar band hai -> Kholo
                    $sideNav.addClass("mobile-open");
                    oBtn.setIcon("sap-icon://decline"); // Cross Icon lao
                }
            } else {
                // Desktop Standard Logic
                var oToolPage = this.byId("adminToolPage");
                oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
                
                // Desktop Icon Change Logic
                var bExpanded = oToolPage.getSideExpanded();
                oBtn.setIcon(bExpanded ? "sap-icon://menu2" : "sap-icon://menu2"); 
                // Note: Desktop pe usually menu icon hi rakhte hain, par agar cross chahiye to yahan change kar lena
            }
        },

        onLogout: function() {
            // Clear all localStorage data
            localStorage.removeItem("userEmail");
            localStorage.removeItem("userRole");
            localStorage.removeItem("loggedDriverID");
            localStorage.removeItem("loggedDriverName");
            localStorage.clear();
            
            // Navigate to main landing page (3 tiles)
            this.getOwnerComponent().getRouter().navTo("RouteView1");
            
            // Show confirmation message
            sap.m.MessageToast.show("Logged out successfully");
        },

        // Notification System
        onNotificationPress: function() {
            if (!this._notificationPopover) {
                this._notificationPopover = sap.ui.xmlfragment("project1.fragment.NotificationPopover", this);
                this.getView().addDependent(this._notificationPopover);
            }
            
            this._loadNotifications();
            this._notificationPopover.openBy(this.byId("notificationBtn"));
        },

        _loadNotifications: function() {
            var sUserID = localStorage.getItem("userID") || "admin";
            var sUserRole = "ADMIN";
            var oModel = this.getOwnerComponent().getModel();
            
            var oListBinding = oModel.bindList("/ActiveDelays");
            var that = this;
            
            oListBinding.requestContexts().then(function(aContexts) {
                var aNotifications = aContexts.map(function(oContext) {
                    return oContext.getObject();
                });
                
                console.log("Admin notifications loaded:", aNotifications.length);
                
                var oNotificationModel = new sap.ui.model.json.JSONModel(aNotifications);
                that.getView().setModel(oNotificationModel, "notificationModel");
                
                // Update notification count
                that._updateNotificationCount(aNotifications.length);
            }).catch(function(oError) {
                console.error("Failed to load notifications:", oError.message);
                // Set empty model in case of error
                var oNotificationModel = new sap.ui.model.json.JSONModel([]);
                that.getView().setModel(oNotificationModel, "notificationModel");
                that._updateNotificationCount(0);
            });
        },

        _updateNotificationCount: function(iCount) {
            var oBtn = this.byId("notificationBtn");
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
            this._loadNotifications();
        },

        onCloseNotifications: function() {
            this._notificationPopover.close();
        },
        
        onExit: function() {
            // Clean up the notification timer
            if (this._notificationTimer) {
                clearInterval(this._notificationTimer);
            }
        }
    });
});