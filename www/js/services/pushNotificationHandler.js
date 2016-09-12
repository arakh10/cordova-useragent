angular.module('hotvibes.services')

    .service('PushNotificationHandler', function($rootScope, $state, AuthService, __) {

        var push = null,
            deviceId = null,
            token = null;

        function onDeviceRegistered(data) {
            if (deviceId && data.registrationId == token) {
                return;
            }

            token = data.registrationId;
            localStorage['deviceToken'] = token;

            if (deviceId) {
                AuthService.getCurrentUser().unregisterDevice(deviceId);
            }

            AuthService.getCurrentUser().registerDevice(token).then(function(device) {
                deviceId = device.id;
                localStorage['deviceId'] = deviceId;
            });
        }

        function onReceivedNotification(notification) {
            $rootScope.$apply(function() {
                $rootScope.$broadcast(
                    notification.additionalData._type,
                    notification.additionalData.payload
                );
            });

            // iOS gives us 30 seconds to handle our background notification
            // Let's notify the system that we have finished and our app process could be killed now
            push.finish();
        }

        function onClickedNotification(notification) {
            // TODO: test, if push.finish(); is required here

            switch (notification.additionalData._type) {
                case 'newMessage.received':
                    $state.go('inside.conversations-single', { id: notification.additionalData.payload.conversationId });
                    break;
            }
        }

        this.init = function() {
            token = localStorage['deviceToken'];
            deviceId = localStorage['deviceId'];

            push = PushNotification.init({
                android: {
                    senderID: 957136533015
                },
                ios: {
                    alert: true,
                    badge: true,
                    sound: true,
                    categories: {
                        newMessage: {
                            yes: {
                                title: __('Reply'), callback: 'message.reply', destructive: false, foreground: false
                            },
                            no: {
                                title: __('Mark as read'), callback: 'message.markAsRead', destructive: false, foreground: false
                            }
                        }
                    }
                },
                windows: {}
            });

            push.on('registration', onDeviceRegistered);
            push.on('notification', function(notification) {
                if (!notification.additionalData || !notification.additionalData._type) {
                    // Malformed notification received. Ignore it
                    return;
                }

                if (notification.additionalData._deviceId != deviceId) {
                    unregister(notification.additionalData._deviceId);
                    return;
                }

                if (notification.additionalData.coldstart && !notification.additionalData.foreground) {
                    onClickedNotification(notification);
                    return;
                }

                onReceivedNotification(notification);
            });
            // push.on('error', function (e) {
            //     console.error(e);
            // });
        };

        this.getToken = function() {
            return token;
        };

        this.unregister = function(deviceToBeUnregisteredId) {
            if (!deviceToBeUnregisteredId) {
                if (!deviceId) {
                    return;
                }

                deviceToBeUnregisteredId = deviceId;
            }

            AuthService.getCurrentUser().unregisterDevice(deviceToBeUnregisteredId);

            if (deviceToBeUnregisteredId == deviceId) {
                token = null;
                deviceId = null;

                localStorage.removeItem('deviceId');
                localStorage.removeItem('deviceToken');

                push.unregister();
            }
        };
    });
