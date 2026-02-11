sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
  ],
  function (
    Controller,
    Fragment,
    JSONModel,
    MessageToast,
    Filter,
    FilterOperator,
  ) {
    "use strict";

    return Controller.extend("project1.controller.View1", {
      onInit: function () {
        // Login Model banayein popup ki details control karne ke liye
        var oLoginModel = new JSONModel({
          portalTitle: "",
          portalIcon: "",
          portalType: "",
          showRegister: false
        });
        this.getView().setModel(oLoginModel, "loginModel");
      },

      // Ye function tab chalega jab koi bhi "Launch Workspace" button press karega
      onLaunchWorkspace: function (oEvent) {
        var oView = this.getView();
        var oButton = oEvent.getSource();
        var oLoginModel = oView.getModel("loginModel");

        // Hum button ki class ya parent se portal type pata kar sakte hain
        // Lekin sabse best hai ki hum Title check kar lein jo uske upar hai
        var sCardTitle = oButton
          .getParent()
          .getItems()
          .find(function (item) {
            return item.getMetadata().getName() === "sap.m.Title";
          })
          .getText();

        // Popup ke content ko Card ke hisab se update karein
        if (sCardTitle.includes("Corporate")) {
          oLoginModel.setProperty("/portalTitle", "Corporate Client Login");
          oLoginModel.setProperty("/portalIcon", "sap-icon://building");
          oLoginModel.setProperty("/portalType", "CUSTOMER");
          oLoginModel.setProperty("/showRegister", true); // Only show register for customers
          console.log("Corporate Client - showRegister set to:", oLoginModel.getProperty("/showRegister"));
        } else if (sCardTitle.includes("Operations")) {
          oLoginModel.setProperty("/portalTitle", "Operations Admin Login");
          oLoginModel.setProperty(
            "/portalIcon",
            "sap-icon://BusinessSuiteInAppSymbols/signal",
          );
          oLoginModel.setProperty("/portalType", "ADMIN");
          oLoginModel.setProperty("/showRegister", false);
          console.log("Admin - showRegister set to:", oLoginModel.getProperty("/showRegister"));
        } else {
          oLoginModel.setProperty("/portalTitle", "Fleet Driver Login");
          oLoginModel.setProperty("/portalIcon", "sap-icon://shipping-status");
          oLoginModel.setProperty("/portalType", "DRIVER");
          oLoginModel.setProperty("/showRegister", false);
          console.log("Driver - showRegister set to:", oLoginModel.getProperty("/showRegister"));
        }

        // Fragment (Popup) load karne ka logic
        if (!this._pDialog) {
          this._pDialog = Fragment.load({
            id: oView.getId(),
            name: "project1.view.LoginDialog",
            controller: this,
          }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
          });
        }

        var that = this;
        this._pDialog.then(function (oDialog) {
          // Show/hide register button based on portal type
          var oRegisterBtn = that.byId("registerBtn");
          if (oRegisterBtn) {
            if (sCardTitle.includes("Corporate")) {
              oRegisterBtn.setVisible(true);
            } else {
              oRegisterBtn.setVisible(false);
            }
          }
          oDialog.open();
        });
      },

      onCloseLogin: function () {
        // Dialog ki ID fragment mein 'loginDialog' hai, isliye wahi use karni hogi
        var oDialog = this.byId("loginDialog");
        if (oDialog) {
          oDialog.close();
          // Input fields clear karein safely
          var oEmail = this.byId("emailInput");
          var oPass = this.byId("passwordInput");

          if (oEmail) oEmail.setValue("");
          if (oPass) oPass.setValue("");
        }
      },
      onLoginSubmit: function () {
        var oView = this.getView();
        var sEmail = oView.byId("emailInput").getValue();
        var sPass = oView.byId("passwordInput").getValue();
        var oLoginModel = oView.getModel("loginModel");
        var sType = oLoginModel.getProperty("/portalType"); // ADMIN, CUSTOMER, or DRIVER

        if (!sEmail || !sPass) {
          sap.m.MessageToast.show("Please enter Email and Password");
          return;
        }

        // --- DRIVER LOGIC START ---
        if (sType === "DRIVER") {
          // Agar driver hai toh sirf ye function chalega aur yahi se code return ho jayega
          this._validateDriverLogin(sEmail, sPass);
          return;
        }
        // --- DRIVER LOGIC END ---

        // Neeche ka code ab sirf ADMIN aur CUSTOMER ke liye chalega
        var oModel = this.getOwnerComponent().getModel();
        var sEntitySet = "/Users"; // Kyunki driver upar handle ho gaya hai

        var aFilters = [
          new sap.ui.model.Filter(
            "email",
            sap.ui.model.FilterOperator.EQ,
            sEmail,
          ),
          new sap.ui.model.Filter(
            "password",
            sap.ui.model.FilterOperator.EQ,
            sPass,
          ),
          new sap.ui.model.Filter(
            "role",
            sap.ui.model.FilterOperator.EQ,
            sType,
          ),
        ];

        sap.ui.core.BusyIndicator.hide();

        var oListBinding = oModel.bindList(sEntitySet, null, null, aFilters);
        oListBinding
          .requestContexts()
          .then(
            function (aContexts) {
              sap.ui.core.BusyIndicator.hide();
              if (aContexts.length > 0) {
                localStorage.clear();
                localStorage.setItem("userEmail", sEmail);
                var oUserData = aContexts[0].getObject();
                sap.m.MessageToast.show(
                  "Welcome " + (oUserData.name || oUserData.companyName),
                );

                this.onCloseLogin();
                
                // Clear any cached models to ensure fresh data
                var oComponent = this.getOwnerComponent();
                var oMainModel = oComponent.getModel();
                if (oMainModel && oMainModel.refresh) {
                  oMainModel.refresh();
                }
                
                this._navigateToDashboard(sType);
              } else {
                sap.m.MessageToast.show(
                  "Invalid Credentials. Please try again.",
                );
              }
            }.bind(this),
          )
          .catch(function (oError) {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageBox.error("Database connection failed.");
          });
      },

      _validateDriverLogin: function (sEmail, sPass) {
        var oModel = this.getOwnerComponent().getModel();
        var that = this;

        sap.ui.core.BusyIndicator.hide(); // Driver ke liye bhi loading dikhayein

        // Filter aur FilterOperator upar define hone chahiye
        var oBinding = oModel.bindList("/Drivers", null, null, [
          new sap.ui.model.Filter(
            "email",
            sap.ui.model.FilterOperator.EQ,
            sEmail,
          ),
          new sap.ui.model.Filter(
            "password",
            sap.ui.model.FilterOperator.EQ,
            sPass,
          ),
        ]);

        oBinding
          .requestContexts()
          .then(function (aContexts) {
            sap.ui.core.BusyIndicator.hide();
            if (aContexts && aContexts.length > 0) {
              localStorage.clear(); // Purana data saaf karein

              var oDriverData = aContexts[0].getObject();

              // OData V4 mein properties case-sensitive hoti hain, check if it's 'ID' or 'id'
              localStorage.setItem(
                "loggedDriverID",
                oDriverData.ID || oDriverData.id,
              );
              localStorage.setItem("loggedDriverEmail", oDriverData.email);
              localStorage.setItem("loggedDriverName", oDriverData.name);

              sap.m.MessageToast.show("Welcome Driver " + oDriverData.name);

              that.onCloseLogin();
              
              // Clear any cached models to ensure fresh data
              var oComponent = that.getOwnerComponent();
              var oMainModel = oComponent.getModel();
              if (oMainModel && oMainModel.refresh) {
                oMainModel.refresh();
              }
              
              var oRouter = that.getOwnerComponent().getRouter();
              oRouter.navTo("DriverDashboard");
            } else {
              sap.m.MessageToast.show("Invalid Driver Credentials.");
            }
          })
          .catch(function (oError) {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show("Login failed.");
          });
      },

      _navigateToDashboard: function (sType) {
        var oRouter = this.getOwnerComponent().getRouter();
        // Manifest routes ke names matching hone chahiye
        if (sType === "CUSTOMER") oRouter.navTo("CustomerDashboard");
        else if (sType === "ADMIN") oRouter.navTo("AdminDashboard");
        else if (sType === "DRIVER") oRouter.navTo("DriverDashboard");
      },

      // Registration functions
      onRegisterPress: function () {
        var oView = this.getView();
        
        if (!this._pRegisterDialog) {
          this._pRegisterDialog = Fragment.load({
            id: oView.getId(),
            name: "project1.view.RegisterDialog",
            controller: this,
          }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
          });
        }

        this._pRegisterDialog.then(function (oDialog) {
          oDialog.open();
        });
        
        // Close login dialog
        this.onCloseLogin();
      },

      onCloseRegister: function () {
        var oDialog = this.byId("registerDialog");
        if (oDialog) {
          oDialog.close();
          this._clearRegisterFields();
        }
      },

      onBackToLogin: function () {
        this.onCloseRegister();
        // Reopen login dialog
        this._pDialog.then(function (oDialog) {
          oDialog.open();
        });
      },

      _clearRegisterFields: function () {
        var oCompany = this.byId("companyInput");
        var oEmail = this.byId("emailRegInput");
        var oPass = this.byId("passwordRegInput");
       

        if (oCompany) oCompany.setValue("");
        if (oEmail) oEmail.setValue("");
        if (oPass) oPass.setValue("");
        
      },

      onRegisterSubmit: function () {
        var oView = this.getView();
        var sCompany = oView.byId("companyInput").getValue();
        var sEmail = oView.byId("emailRegInput").getValue();
        var sPassword = oView.byId("passwordRegInput").getValue();
       

        if (!sCompany || !sEmail || !sPassword) {
          MessageToast.show("Please fill all required fields");
          return;
        }

        // Email validation
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sEmail)) {
          MessageToast.show("Please enter a valid email address");
          return;
        }

        var oModel = this.getOwnerComponent().getModel();
        var oNewUser = {
          companyName: sCompany,
          email: sEmail,
          password: sPassword,
          role: "CUSTOMER",
      
        };

        sap.ui.core.BusyIndicator.hide(0);

        // First check if email already exists
        var oBinding = oModel.bindList("/Users", null, null, [
          new Filter("email", FilterOperator.EQ, sEmail)
        ]);

        var that = this;
        oBinding.requestContexts().then(function (aContexts) {
          if (aContexts.length > 0) {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("Email already registered. Please use a different email.");
            return;
          }

          // Create new user
          var oListBinding = oModel.bindList("/Users");
          var oContext = oListBinding.create(oNewUser);
          
          oContext.created().then(function () {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("Registration successful! You can now login.");
            that.onCloseRegister();
            
            // Open login dialog again
            that._pDialog.then(function (oDialog) {
              oDialog.open();
            });
          }).catch(function (oError) {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("Registration failed. Please try again.");
          });
        }).catch(function (oError) {
          sap.ui.core.BusyIndicator.hide();
          MessageToast.show("Registration failed. Please try again.");
        });
      },
    });
  },
);
