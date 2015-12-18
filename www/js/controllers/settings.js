angular.module('hotvibes.controllers')

    .controller('SettingsProfileCtrl', function(
        $scope, $ionicLoading, $ionicModal, $q,
        __, Country, CityPicker, ErrorCode
    ) {
        $scope.settings = {
            city: $scope.currUser.city,
            country: { id: $scope.currUser.country },
            profile: { phoneNumber: $scope.currUser.profile.phoneNumber },
            email: $scope.currUser.email
        };

        $scope.$watch('settings.country', function(newVal, oldVal) {
            if (newVal === oldVal) {
                return;
            }

            $scope.settings.city = '';
        });

        $scope.save = function() {
            $ionicLoading.show({ template: __('Please wait') + '..' });

            $scope.currUser.$update(
                FormUtils.getDirtyFields($scope.settings.form).settings

            ).then(
                function() {
                    $scope.currUser.city = $scope.settings.city;
                    $scope.currUser.country = $scope.settings.country.id;

                    if ($scope.settings.profile.phoneNumber != $scope.currUser.profile.phoneNumber) {
                        $scope.currUser.profile.phoneNumber = $scope.settings.profile.phoneNumber;
                        $scope.currUser.profile.isPhoneNumberConfirmed = false;
                    }

                    if ($scope.settings.email != $scope.currUser.email) {
                        $scope.currUser.email = $scope.settings.email;
                        $scope.currUser.profile.isEmailConfirmed = false;
                    }

                    $scope.settings.form.$setPristine();

                    $ionicLoading.show({
                        template: __('Saved'),
                        noBackdrop: true,
                        duration: 1000
                    });
                },
                $scope.onError

            ).finally(function() {
                $ionicLoading.hide();
            });
        };

        $scope.countries = Country.query();

        new CityPicker({
            getCountry: function() {
                return $scope.settings.country;
            },
            onCitySelected: function(city) {
                $scope.settings.city = city.label;
                $scope.settings.form.settings.city.$setDirty();
            }
        }).then(function(modal) {
            $scope.modal = modal;
        });

        $scope.password = {};
        $scope.changePassword = function() {
            $ionicLoading.show({ template: __('Please wait') + '..' });

            $scope.currUser.$update({
                password: $scope.password.new,
                _params: { oldPassword: $scope.password.old }

            }).then(
                function() {
                    $ionicLoading.show({
                        template: __('Password has been successfully changed'),
                        noBackdrop: true,
                        duration: 1000
                    });

                    $scope.logout();
                },
                function(error) {
                    var params = null;
                    if (error.data && error.data.code && error.data.code == ErrorCode.INVALID_CREDENTIALS) {
                        params = { message: __("Invalid password") }
                    }

                    $scope.onError(error, params);
                }

            ).finally(function() {
                $ionicLoading.hide();
            });
        };
    })

    .controller('SettingsAboutCtrl', function($scope, $ionicLoading, __) {
        $scope.selectables = [
            {id: 'maritalStatus', label: __('Status:'), options: []},
            {id: 'living', label: __('Living'), options: []},
            {id: 'smoking', label: __('Smoking'), options: []},
            {id: 'drinking', label: __('Drinking'), options: []},
            {id: 'education', label: __('Education'), options: []}
        ];

        $scope.purposes = [
            {id: 'dating', label: __('Real dates')},
            {id: 'sex', label: __('S&M')},
            {id: 'chat', label: __('Online chat')},
            {id: 'relationship', label: __('Normal relationships')},
            {id: 'marriage', label: __('Mariage')}
        ];

        $scope.save = function() {
            // TODO: implement
            $ionicLoading.show();
        };
    })

    .controller('SettingsAlbumsCtrl', function($scope, $ionicPopover, $ionicPopup, $ionicLoading, __, Album) {
        $scope.albums = Album.query({ include: 'thumbUrl(size=w80h80)' });

        $scope.promptCreateAlbum = {
            albumName: null
        };

        $scope.createAlbum = function() {
            $ionicPopup.prompt({
                title: __('Add New Album'),
                subTitle: __('Enter album name'),
                template: '<input type="text" ng-model="promptCreateAlbum.albumName" required />',
                scope: $scope,
                buttons: [
                    { text: __('Cancel') },
                    {
                        text: '<b>' + __('Create') + '</b>',
                        type: 'button-positive',
                        onTap: function(event) {
                            if (!$scope.promptCreateAlbum.albumName) {
                                event.preventDefault();
                                // TODO: show error
                                return null;
                            }

                            return $scope.promptCreateAlbum.albumName;
                        }
                    }
                ]

            }).then(function(name) {
                if (!name) {
                    return;
                }

                $ionicLoading.show({ template: __('Please wait') + '..' });

                var album = new Album({ name: name });
                album.$save().then(
                    function() {
                        $scope.albums.push(album);
                    },

                    $scope.onError

                ).finally(function() {
                        $ionicLoading.hide();
                    });
            });
        };
    })

    .controller('SettingsAlbumCtrl', function(
        $scope, $stateParams, $ionicHistory, $ionicLoading, $ionicPopover,
        __, MediaFile, Album, Rule, ErrorCode
    ) {
        var thumbParams = 'size=w80h80';

        $scope.album = Album.get({
            id: $stateParams.albumId,
            include: 'photos.url(' + thumbParams + ')'
        });

        $scope.photoOptions = function($index, $event) {
            $ionicPopover.fromTemplateUrl('templates/popover_photo_options.html', {
                scope: $scope

            }).then(function(popover) {
                popover.show($event);
            });

            // TODO: photo actions: delete, set as main, etc
        };

        var filePicker;

        $scope.$on('$ionicView.afterEnter', function() {
            filePicker = document.querySelector('ion-view[nav-view="active"] #file-picker');
            filePicker.removeEventListener('change');
            filePicker.addEventListener('change', function(event) {
                $ionicLoading.show({ template: __('Uploading') + '..' });

                var file = new MediaFile({
                    albumId: $stateParams.albumId,
                    file: event.target.files[0]
                });

                // Upload the file
                file.$save().then(function(response) {
                    // Display the newly uploaded file
                    $scope.album.photos.push(
                        MediaFile.get({
                            albumId: $stateParams.albumId,
                            id: response.id,
                            include: 'url(' + thumbParams + ')'
                        })
                    );

                }, function(error) {
                    if (
                        error.status == 400
                        && error.data.rule
                        && error.data.rule.type == Rule.MIN_VALUE
                        && (error.data.rule.field == 'width' || error.data.rule.field == 'height')
                    ) {
                        error.data.code = ErrorCode.IMAGE_SIZE_INVALID
                    }

                    $scope.onError(error);

                }).finally(function() {
                    $ionicLoading.hide();
                });
            });
        });

        $scope.openFilePicker = function() {
            ionic.trigger('click', { target: filePicker });
        };

        $scope.deleteAlbum = function() {
            $scope.album.$delete();
            //$rootScope.$broadcast('');
            // FIXME: notify albums list about deleted element

            $ionicHistory.goBack();
        };
    });