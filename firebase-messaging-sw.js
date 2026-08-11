importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBH3RuAfTRim8tPpNZ6tOUv2JuyrSQFQyY",
    authDomain: "rkc-voip.firebaseapp.com",
    projectId: "rkc-voip",
    storageBucket: "rkc-voip.firebasestorage.app",
    messagingSenderId: "160684406510",
    appId: "1:160684406510:web:6e22f5f26a0829b1c025ff",
    measurementId: "G-C4GW1K6MJK"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log("Background Message Received: ", payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.ico'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});
