sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
  ],
  function (Controller, MessageToast, MessageBox, Fragment) {
    "use strict";

    return Controller.extend("project1.controller.NewBooking", {
      _pickupCoords: null,
      _dropCoords: null,
      _fCurrentDistance: 0,

      onInit: function () {
        this._aTruckIDs = ["truckOpen", "truckContainer", "truckReefer"];
        this._selectedTruck = "truckContainer";

        this._aTruckIDs.forEach(function (sId) {
          var oControl = this.byId(sId);
          if (oControl) {
            oControl.addEventDelegate({
              onclick: function () {
                this._onTruckSelect(sId);
              }.bind(this),
            });
          }
        }, this);
      },

      _onTruckSelect: function (sId) {
        this._aTruckIDs.forEach(function (id) {
          var oCard = this.byId(id);
          if (oCard) {
            oCard.removeStyleClass("selectedTruck");
          }
        }, this);

        var oSelectedCard = this.byId(sId);
        if (oSelectedCard) {
          oSelectedCard.addStyleClass("selectedTruck");
          this._selectedTruck = sId;
        }

        this._recalculateEverything();
      },

      onOpenMap: function (oEvent) {
        this._oInputSource = oEvent.getSource();
        var oView = this.getView();

        if (!this._pMapDialog) {
          this._pMapDialog = Fragment.load({
            id: oView.getId(),
            name: "project1.view.MapDialog",
            controller: this,
          }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
          });
        }

        this._pMapDialog.then(
          function (oDialog) {
            oDialog.open();
            setTimeout(
              function () {
                this._initLeaflet();
              }.bind(this),
              500,
            );
          }.bind(this),
        );
      },

      _initLeaflet: function () {
        var oMapDomRef = this.byId("leafletMapContainer").getDomRef();

        if (this._oMap) {
          this._oMap.remove();
          this._oMap = null;
          this._oMarker = null;
        }

        this._oMap = L.map(oMapDomRef).setView([20.5937, 78.9629], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
          this._oMap,
        );

        var that = this;
        this._oMap.on("click", function (e) {
          var lat = e.latlng.lat;
          var lng = e.latlng.lng;

          if (that._oMarker) {
            that._oMarker.setLatLng(e.latlng);
          } else {
            that._oMarker = L.marker(e.latlng).addTo(that._oMap);
          }

          that._getAddressFromCoords(lat, lng);
        });

        setTimeout(() => {
          this._oMap.invalidateSize();
        }, 200);
      },

      _getAddressFromCoords: function (lat, lng) {
        var that = this;
        var sUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

        fetch(sUrl)
          .then((response) => response.json())
          .then((data) => {
            var sAddress =
              data.display_name || lat.toFixed(4) + ", " + lng.toFixed(4);
            if (that._oInputSource) {
              that._oInputSource.setValue(sAddress);
            }
            
            if (that._oInputSource.getId().includes("inputPickup")) {
              that._pickupCoords = { lat, lng };
            } else {
              that._dropCoords = { lat, lng };
            }

            if (that._pickupCoords && that._dropCoords) {
              that._calculateRoute();
            }
          })
          .catch((err) => {
            that._oInputSource.setValue(lat.toFixed(4) + ", " + lng.toFixed(4));
          });
      },

      onCloseMapDialog: function () {
        var oDialog = this.byId("mapDialog") || this.byId("_IDGenDialog");
        if (oDialog) {
          oDialog.close();
        }
      },

      onAfterRendering: function () {
        this._oNavContainer = this.byId("wizardNavContainer");
        var oPage1 = this.byId("pageConsignment");
        if (this._oNavContainer && oPage1) {
          this._oNavContainer.to(oPage1);
        }
        this._updateHeader(1);
      },

      onIncrement: function () {
        var oInput = this.byId("inputWeight");
        if (!oInput) return;
        var iValue = parseInt(oInput.getValue()) || 0;
        if (iValue < 100) {
          oInput.setValue(iValue + 1);
        }
      },

      onDecrement: function () {
        var oInput = this.byId("inputWeight");
        if (!oInput) return;
        var iValue = parseInt(oInput.getValue()) || 0;
        if (iValue > 1) {
          oInput.setValue(iValue - 1);
        }
      },

      onPriorityChange: function () {
        this._recalculateEverything();
      },

      _recalculateEverything: function () {
        if (this._fCurrentDistance > 0) {
          this._updateDetailedBill(this._fCurrentDistance);
        }
      },

      _calculateRoute: function () {
        var that = this;
        var sUrl = `https://router.project-osrm.org/route/v1/driving/${this._pickupCoords.lng},${this._pickupCoords.lat};${this._dropCoords.lng},${this._dropCoords.lat}?overview=false`;

        fetch(sUrl)
          .then((response) => response.json())
          .then((data) => {
            if (data.routes && data.routes.length > 0) {
              var oRoute = data.routes[0];
              var distance = Math.round(oRoute.distance / 1000);
              that._fCurrentDistance = distance;

              var realisticDurationMin = Math.round((distance / 40) * 60);
              var fDurationHrs = realisticDurationMin / 60;
              var sTime = fDurationHrs >= 1
                ? Math.floor(fDurationHrs) + "h " + Math.round((fDurationHrs % 1) * 60) + "m"
                : Math.round(realisticDurationMin) + "m";

              that.byId("_IDGenTitle13").setText(distance + " KM");
              that.byId("_IDGenTitle25").setText(sTime);

              that._updateDetailedBill(distance);
            }
          })
          .catch(function (error) {
            console.error("Route calculation failed:", error);
          });
      },

      _updateDetailedBill: function (fDistance) {
        var oModel = this.getView().getModel();
        var oOperation = oModel.bindContext("/calculatePrice(...)");
        oOperation.setParameter("weight", parseFloat(this.byId("inputWeight").getValue()));
        oOperation.setParameter("distance", parseFloat(fDistance));
        oOperation.setParameter("truckType", this._selectedTruck);
        oOperation.setParameter("priority", this.byId("prioritySeg").getSelectedKey());

        oOperation.execute().then(
          function () {
            var oResult = oOperation.getBoundContext().getObject();
            if (oResult && oResult.baseFreight !== undefined) {
              this.byId("_IDGenText34").setText("₹ " + oResult.baseFreight.toLocaleString("en-IN"));
              this.byId("_IDGenText38").setText("₹ " + oResult.gst.toLocaleString("en-IN"));
              this.byId("_IDGenTitle28").setText("₹ " + oResult.totalFare.toLocaleString("en-IN"));
            }
          }.bind(this),
        );
      },

      onToLogistics: function () {
        var oPage = this.byId("pageLogistics");
        if (this._oNavContainer && oPage) {
          this._oNavContainer.to(oPage);
          this._updateHeader(2);
        }
      },

      onBackToConsignment: function () {
        this._oNavContainer.back();
        this._updateHeader(1);
      },

      onToPricing: function () {
        var oPage = this.byId("pagePricing");
        if (this._oNavContainer && oPage) {
          this._oNavContainer.to(oPage);
          this._updateHeader(3);
        }
      },

      onBackToLogistics: function () {
        this._oNavContainer.back();
        this._updateHeader(2);
      },

      onToConfirm: function () {
        var oPage = this.byId("pageConfirm");
        if (this._oNavContainer && oPage) {
          this._oNavContainer.to(oPage);
          this._updateHeader(4);
        }
      },

      onBackToPricing: function () {
        this._oNavContainer.back();
        this._updateHeader(3);
      },

      _updateHeader: function (iStep) {
        var s1 = this.byId("step1Ind");
        var s2 = this.byId("step2Ind");
        var s3 = this.byId("step3Ind");
        var s4 = this.byId("step4Ind");

        var l1 = this.byId("line1");
        var l2 = this.byId("line2");
        var l3 = this.byId("line3");

        if (!s1 || !s2 || !s3 || !s4) {
          return;
        }

        [s1, s2, s3, s4].forEach(function (s) {
          s.removeStyleClass("stepActive");
          s.removeStyleClass("stepCompleted");
        });

        if (l1) l1.removeStyleClass("stepProgressLine");
        if (l2) l2.removeStyleClass("stepProgressLine");
        if (l3) l3.removeStyleClass("stepProgressLine");

        switch (iStep) {
          case 1:
            s1.addStyleClass("stepActive");
            break;
          case 2:
            s1.addStyleClass("stepCompleted");
            if (l1) l1.addStyleClass("stepProgressLine");
            s2.addStyleClass("stepActive");
            break;
          case 3:
            s1.addStyleClass("stepCompleted");
            s2.addStyleClass("stepCompleted");
            if (l1) l1.addStyleClass("stepProgressLine");
            if (l2) l2.addStyleClass("stepProgressLine");
            s3.addStyleClass("stepActive");
            break;
          case 4:
            s1.addStyleClass("stepCompleted");
            s2.addStyleClass("stepCompleted");
            s3.addStyleClass("stepCompleted");
            if (l1) l1.addStyleClass("stepProgressLine");
            if (l2) l2.addStyleClass("stepProgressLine");
            if (l3) l3.addStyleClass("stepProgressLine");
            s4.addStyleClass("stepActive");
            break;
        }
      },

      _getTruckTypeFromSelection: function() {
        var truckTypeMap = {
          "truckOpen": "Open Bed",
          "truckContainer": "Container", 
          "truckReefer": "Refrigerated"
        };
        return truckTypeMap[this._selectedTruck] || "Container";
      },

     onConfirmDispatch: function () {
        var oView = this.getView();
        var oModel = oView.getModel();
        var sUserEmail = localStorage.getItem("userEmail");

        var sPickupAddr = oView.byId("inputPickup").getValue();
        var sDropAddr = oView.byId("inputDrop").getValue();
        var sMaterial = oView.byId("inputMaterial").getValue();
        var sWeight = oView.byId("inputWeight").getValue();
        var sReceiver = oView.byId("inputReceiver").getValue();
        var sReceiverEmail = oView.byId("inputReceiver2").getValue();
        var sReceiverPhone = oView.byId("inputReceiver3").getValue();
        
        if (!sPickupAddr || !sDropAddr || !sMaterial || !sWeight || sWeight === "0" || 
            !sReceiver || !sReceiverEmail || !sReceiverPhone) {
          sap.m.MessageBox.error("Please fill all required fields before confirming.");
          return;
        }
        
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sReceiverEmail)) {
          sap.m.MessageBox.error("Please enter a valid email address.");
          return;
        }
        
        var phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(sReceiverPhone)) {
          sap.m.MessageBox.error("Please enter a valid 10-digit phone number.");
          return;
        }
        
        if (!this._pickupCoords || !this._dropCoords) {
          sap.m.MessageBox.error("Please select pickup and drop locations from map.");
          return;
        }

        if (!sUserEmail) {
          sap.m.MessageBox.error("User session not found. Please log in again.");
          return;
        }

        var sCalculatedETA = oView.byId("_IDGenTitle25").getText();
        var fWeight = parseFloat(sWeight);

        if (!sPickupAddr.includes("India") || !sDropAddr.includes("India")) {
          sap.m.MessageBox.error("Service limited to India only.");
          return;
        }

        sap.ui.core.BusyIndicator.show(0);

        var oListBinding = oModel.bindList("/Users", null, null, [
          new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, sUserEmail)
        ]);

        oListBinding.requestContexts(0, 1).then(function (aContexts) {
          if (aContexts.length === 0) {
            sap.ui.core.BusyIndicator.hide();
            throw new Error("User record not found.");
          }

          var sUserID = aContexts[0].getProperty("ID");
          var sNewShipmentID = "LOG-" + Date.now().toString().slice(-6);
          var oPriorityMap = { std: "Standard", exp: "Express", urg: "Urgent" };
          var sSelectedPriority = oPriorityMap[oView.byId("prioritySeg").getSelectedKey()] || "Standard";

          var oShipmentPayload = {
            ID: sNewShipmentID,
            materialCategory: sMaterial,
            loadWeightTons: fWeight,
            pickupLocation: sPickupAddr,
            dropLocation: sDropAddr,
            receiverCompany: sReceiver,
            receiverPhone: sReceiverPhone,
            receiverEmail: sReceiverEmail,
            priority: sSelectedPriority,
            totalDistance: this._fCurrentDistance,
            requiredVehicleType: this._getTruckTypeFromSelection(),
            totalFare: parseFloat(oView.byId("_IDGenTitle28").getText().replace(/[^\d.-]/g, "")),
            status: "Pending",
            customer_ID: sUserID,
            assignment: {
                eta: sCalculatedETA
            }
          };

          var oShipmentBinding = oModel.bindList("/AdminShipments");
          var oNewShipmentContext = oShipmentBinding.create(oShipmentPayload);

          return oNewShipmentContext.created().then(function () {
            return oModel.submitBatch("$auto");
          }).then(function () {
            var oOperation = oModel.bindContext("LogiChainService.draftActivate(...)", oNewShipmentContext);
            return oOperation.execute();
          });

        }.bind(this)).then(function () {
          sap.ui.core.BusyIndicator.hide();
          sap.m.MessageToast.show("Booking Successful! Trip Assigned.");

          this.byId("inputSender")?.setValue("");
          this.byId("inputReceiver").setValue("");
          this.byId("inputReceiver2").setValue("");
          this.byId("inputReceiver3").setValue("");
          this.byId("inputMaterial").setValue("");
          this.byId("inputWeight").setValue("10");
          this.byId("inputPickup").setValue("");
          this.byId("inputDrop").setValue("");
          this.byId("prioritySeg").setSelectedKey("std");

          this._pickupCoords = null;
          this._dropCoords = null;
          this._fCurrentDistance = 0;

          this.byId("step1Ind").addStyleClass("stepActive");
          ["step2Ind", "step3Ind", "step4Ind"].forEach((id) =>
            this.byId(id).removeStyleClass("stepActive")
          );

          var oNavCon = this.byId("wizardNavContainer");
          oNavCon.to(this.byId("pageConsignment"));

          setTimeout(function () {
            this.getOwnerComponent().getRouter().navTo("CustomerDashboard");
          }.bind(this), 1500);

        }.bind(this)).catch(function (oError) {
          sap.ui.core.BusyIndicator.hide();
          sap.m.MessageBox.error("Process Failed: " + (oError.message || oError.toString()));
        });
      },
    });
  },
);