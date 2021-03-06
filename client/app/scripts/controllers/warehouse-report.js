(function () {
  'use strict';
  /**
   * @ngdoc function
   * @name ShoppinPalApp.controller:WarehouseReportCtrl
   * @description
   * # WarehouseReportCtrl
   * Controller of the ShoppinPalApp
   */
  angular.module('ShoppinPalApp').controller('WarehouseReportCtrl', [
    '$scope', '$state', '$stateParams', '$anchorScroll', '$location', /* angular's modules/services/factories etc. */
    'loginService', 'StockOrderLineitemModel', 'ReportModel', /* shoppinpal's custom modules/services/factories etc. */
    'deviceDetector', 'ngDialog', '$filter', /* 3rd party modules/services/factories etc. */
    function ($scope, $state, $stateParams, $anchorScroll, $location,
              loginService, StockOrderLineitemModel, ReportModel,
              deviceDetector, ngDialog, $filter)
    {
      var ROW_STATE_COMPLETE = 'boxed';

      $scope.submit = 'Submit';
      $scope.closeBoxButtonLabel = 'CLOSE THIS BOX';
      //$scope.printSlipButtonLabel = 'PRINT PACKING SLIP';
      $scope.ReviewSubmitPage = true;
      $scope.deviceDetector = deviceDetector;
      $scope.boxes = [];
      $scope.selectedBox = null;
      $scope.items = [];
      $scope.allProcessed = false;

      /** @method onEditInit()
       * This method is called once user choose to edit a row using right swipe
       */
      $scope.onEditInit = function (item) {
        var shoppinPalMainDiv = angular.element(document.querySelector('.shoppinPal-warehouse'));
        if ($scope.deviceDetector.isDesktop()) {
          shoppinPalMainDiv.bind('mousedown', function (event) {
            if (!event.target.classList.contains('editable-panel')) {
              $scope.dismissEdit(item);
              shoppinPalMainDiv.unbind('mousedown');
            }
          });
        } else {
          shoppinPalMainDiv.bind('touchstart', function (event) {
            if (!event.target.classList.contains('editable-panel')) {
              $scope.dismissEdit(item);
              shoppinPalMainDiv.unbind('touchstart');
            }
          });
        }
      };

      /** @method dismissEdit
       * This method will close the editable mode in store-report
       */
      $scope.dismissEdit = function (storeReportRow) {
        // update the backend
        /*console.log('update', {
          fulfilledQuantity: storeReportRow.fulfilledQuantity,
          comment: storeReportRow.comment
        });*/
        $scope.waitOnPromise = StockOrderLineitemModel.prototype$updateAttributes(
          { id: storeReportRow.id },
          {
            fulfilledQuantity: storeReportRow.fulfilledQuantity,
            comment: storeReportRow.comment
          }
        )
          .$promise.then(function(response){
            //console.log('updated', response);
            storeReportRow.updatedAt = response.updatedAt;
            $scope.selectedRowIndex = $scope.storereportlength + 1; // dismiss the edit view in UI
            //$scope.selectedRowIndex = -1; // @ayush: is there merit to one over the other?
          });
      };

      /** @method printDiv
       * @param divName
       * Print packaging slip
       */
      $scope.printSlip = function (divName) {
        var printContents = document.getElementById(divName).innerHTML;
        var popupWin = window.open('', '_blank', 'width=300,height=300');
        popupWin.document.open();
        var printSlipHTML =
            '<html><head><link rel="stylesheet" type="text/css" href="style.css" />' +
            '</head><body onload="window.print()">' + printContents + '</html>';
        popupWin.document.write(printSlipHTML);
        popupWin.document.close();
      };

      /** @method submitToReceiver
       * Submit the warehouse page to receiver
       */
      $scope.submitToReceiver = function () {
        var dialog = ngDialog.open({ template: 'views/popup/submitToReceiverPopUp.html',
          className: 'ngdialog-theme-plain',
          scope: $scope
        });
        dialog.closePromise.then(function (data) {
          //console.log('dialog has been dismissed: ', data);
          //console.log('proceed?', data.value);
          var proceed = data.value;
          if (proceed) {
            //console.log('submitting report');
            ReportModel.prototype$updateAttributes(
              { id: $stateParams.reportId },
              {
                state: 'receiver'
              }
            )
              .$promise.then(function(/*response*/){
                //console.log('updated report', response);
                $state.go('warehouse-landing');
              });
          }
        });
      };

      var setupUnboxedItems = function(response) {
        $scope.orderedItems = _.filter(response, function(item){
          return item.state !== 'boxed';
        });
        // if fulfilledQuantity hasn't been set, then it should equal orderQuantity by default
        angular.forEach($scope.orderedItems, function (item) {
          if(item.fulfilledQuantity === undefined || item.fulfilledQuantity === null) {
            item.fulfilledQuantity = item.orderQuantity;
          }
        });
        // copy the items (order by type) to a new list for display
        $scope.items = $filter('orderBy')(angular.copy($scope.orderedItems), 'type');
      };

      var setupBoxes = function(response){
        var existingBoxes = _.chain(response).countBy('boxNumber').value();
        //console.log(existingBoxes);
        if (existingBoxes && _.keys(existingBoxes).length > 0) {
          populateExistingBoxes(existingBoxes);
        }
        else {
          $scope.addNewBox();
        }
      };

      /** @method addNewBox
       * @description
       * New open box added at top box status
       */
      $scope.addNewBox = function () {
        var box = {
          'boxNumber': $scope.boxes.length + 1,
          'boxName': 'Box' + String($scope.boxes.length + 1),
          'totalItems': 0,
          'isOpen': true
        };
        $scope.boxes.push(box);
        $scope.selectedBox = $scope.boxes[$scope.boxes.length - 1];
      };

      var populateExistingBoxes = function(existingBoxes) {
        var boxNumbersAsKeys = _.filter(_.keys(existingBoxes),function(key){
          var number = Number(key);
          return _.isNumber(number) && _.isFinite(number);
        }); // Math.max.apply(null, boxNumbersAsKeys)
        //console.log(boxNumbersAsKeys);

        // NOTE: maxBoxNumber most likely equals the length of existingBoxes anyway
        //       so there shouldn't be any need to explicitly calculate it
        //var maxBoxNumber = Math.max.apply(null, boxNumbersAsKeys);
        //console.log(maxBoxNumber);

        _.each(boxNumbersAsKeys, function(boxNumberAsKey){
          var box = {
            'boxNumber': Number(boxNumberAsKey),
            'boxName': 'Box' + boxNumberAsKey,
            'totalItems': existingBoxes[boxNumberAsKey],
            // keep the box with the biggest #, open by default
            'isOpen': (Number(boxNumberAsKey) === boxNumbersAsKeys.length) ? true : false
          };
          //console.log('adding', box);
          $scope.boxes.push(box);
          $scope.selectedBox = $scope.boxes[$scope.boxes.length - 1]; // ASSUMPTION: boxNumbersAsKeys is already naturally sorted
        });
      };

      /** @method closeBox
       * This will close the box
       */
      $scope.closeBox = function () {
        //box.isOpen = false;
        $scope.selectedBox.isOpen = false;
        $scope.selectedBox = null;
      };

      /** @method moveToBox
       * This method assigns selected box number and box name to the item swiped to right
       */
      $scope.moveToBox = function (item, index) {
        if($scope.selectedBox) {
          $scope.selectedBox.totalItems ++; // update totals for current box
          $scope.items.splice(index, 1); // remove the item from the currently rendered list

          $scope.waitOnPromise = StockOrderLineitemModel.prototype$updateAttributes(
            { id: item.id },
            {
              fulfilledQuantity: item.fulfilledQuantity,
              comment: item.comment,
              boxNumber: $scope.selectedBox.boxNumber,
              state: ROW_STATE_COMPLETE
            }
          )
            .$promise.then(function(response){
              //console.log('hopefully finished updating the row');
              //console.log(response);

              // change the UI after the backend finishes for data-integrity/assurance
              // but if this visibly messes with UI/UX, we might want to do it earlier...
              item.updatedAt = response.updatedAt;
              item.state = ROW_STATE_COMPLETE;

              // check if all items have been processed, if yes close the box and enable submit button
              if($scope.items.length === 0) {
                $scope.allProcessed = true;
                $scope.closeBox($scope.selectedBox);
              }

              // keep the departments updated as per the remaining items
              $scope.jumpToDepartment();
            });
        } else {
          // TODO: remove this alert and use some good stuff
          alert('Please open a box');
        }
      };

      /** @method editWarehouse
       * @param selectedRow
       * enable the edit mode in UI
       */
      $scope.editWarehouse = function (selectedRow) {
        $scope.selectedRowIndex = selectedRow;
      };

      /** @method decreaseQty
       * @param item
       * This method decreases the desiredStockLevel quantity ,when user tap on '-'' sign
       */
      $scope.decreaseQty = function (item) {
        item.fulfilledQuantity = parseInt(item.fulfilledQuantity, 10); // parse it from string to integer
        if (item.fulfilledQuantity > 0) {
          item.fulfilledQuantity -= 1;
        }
      };

      /** @method increaseQty
       * @param item
       * This method increase the desiredStockLevel quantity ,when user tap on '+' sign
       */
      $scope.increaseQty = function (item) {
        item.fulfilledQuantity = parseInt(item.fulfilledQuantity, 10);
        item.fulfilledQuantity += 1;
      };


      /** @method goToDepartment
       * @param value
       * This method
       */
      $scope.goToDepartment = function (value) {
        var jumpToHash;
        if (value) {
          for (var i = 0; i < $scope.items.length; i++) {
            var type = $scope.items[i].type,
                typeFirstChar = type.slice(0, 1).toUpperCase();
            $scope.alphabets.push(typeFirstChar);
            if (typeFirstChar === value) {
              jumpToHash = 'jumpTo' + $scope.items[i].type;
              break; // stop at the first matching department
            }
          }

        }
        $location.hash(jumpToHash);
        $anchorScroll();
      };

      /** @method jumpToDepartment
       * This method will return available departments firstChar for jumpTo department functionality
       */
      $scope.jumpToDepartment = function () {
        $scope.alphabets = [];
        for (var i = 0; i < $scope.items.length; i++) {
          var type = $scope.items[i].type,
              typeFirstChar = type.slice(0, 1).toUpperCase();
          $scope.alphabets.push(typeFirstChar);
        }
        $scope.alphabets.sort();
      };

      /*var makeItEasyToTestSubmission = function(){
        // auto place N-1 items in a box
        $scope.selectedBox.totalItems = $scope.orderedItems.length-1;
        $scope.items = [$scope.orderedItems[$scope.orderedItems.length-1]];
        console.log(
          '$scope.orderedItems.length', $scope.orderedItems.length, '\n',
          '$scope.items.length', $scope.items.length, '\n',
          '$scope.selectedBox.totalItems', $scope.selectedBox.totalItems
        );
      };*/

      // -------------
      // Load the data
      // -------------

      /** @method viewContentLoaded
       * This method will load the storesReport from api on view load
       */
      $scope.$on('$viewContentLoaded', function () {
        if($stateParams.reportId) {
          $scope.waitOnPromise = loginService.getReport($stateParams.reportId)
            .then(function (response) {
              setupBoxes(response);
              setupUnboxedItems(response);
              //makeItEasyToTestSubmission();
              $scope.jumpToDepartment();
            });
        }
        else { // if live data can't be loaded due to some bug, use MOCK data so testing can go on
          loginService.getWarehouseReport().then(function (response) {
            $scope.orderedItems = response.data.stockOrderLineitemModels;
            angular.forEach($scope.orderedItems, function (item) {
              item.fulfilledQuantity = item.orderQuantity;
            });
            // copy the items (order by type) to a new list for display
            $scope.items = $filter('orderBy')(angular.copy($scope.orderedItems), 'type');
            $scope.addNewBox();
            $scope.jumpToDepartment();
          });
        }
      });
    }
  ]);
}());