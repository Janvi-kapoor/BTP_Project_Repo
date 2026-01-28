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

            // 1. Mobile Check on Load: Start Collapsed
            if (Device.system.phone) {
                var oToolPage = this.byId("adminToolPage");
                if (oToolPage) {
                    oToolPage.setSideExpanded(false);
                }
            }
        },

        // 🟢 BUTTON CLICK FIX (Isse click 100% pakda jayega)
        onAfterRendering: function() {
            var oBtn = this.byId("sideNavBtn2");
            var that = this;

            if (oBtn) {
                // Purane events clear karke Browser Event lagaya
                oBtn.$().off("tap click touchstart");

                oBtn.attachBrowserEvent("click touchstart", function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Seedha Toggle Function Call
                    that.onSideNavButtonPress();
                });
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
        }
    });
});