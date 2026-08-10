import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBH3RuAfTRim8tPpNZ6tOUv2JuyrSQFQyY",
    authDomain: "rkc-voip.firebaseapp.com",
    projectId: "rkc-voip",
    storageBucket: "rkc-voip.firebasestorage.app",
    messagingSenderId: "160684406510",
    appId: "1:160684406510:web:6e22f5f26a0829b1c025ff",
    measurementId: "G-C4GW1K6MJK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserId = null;
let currentUserEmail = "";
let currentVirtualNumber = "";
let localStream = null;
let peerConnection = null;
let callLogs = [];
let savedContacts = [];
let currentBalanceValue = 0;

const ADMIN_EMAIL = "eibrahimm028q@gmail.com";

// STUN সার্ভার WebRTC পিয়ার কানেকশনের জন্য
const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

window.showPage = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    let targetPage = document.getElementById(pageId);
    if(targetPage) targetPage.classList.add('active');

    if(pageId === 'adminPage') {
        window.loadAdminRequests();
    }
}

window.toggleMenu = function(event) {
    event.stopPropagation();
    let menu = document.getElementById("settingsMenu");
    if(menu) menu.classList.toggle("show");
}

window.closeMenu = function() {
    let menu = document.getElementById("settingsMenu");
    if(menu) menu.classList.remove("show");
}

window.onclick = function(event) {
    if (!event.target.matches('.menu-icon')) {
        let menu = document.getElementById("settingsMenu");
        if (menu && menu.classList.contains('show')) {
            menu.classList.remove('show');
        }
    }
}

// ইউনিক ভার্চুয়াল নাম্বার তৈরি করার ফাংশন (যেমন: 1001, 1002...)
async function generateUniqueVirtualNumber() {
    let randomNum = Math.floor(1000 + Math.random() * 9000).toString();
    return randomNum;
}

window.registerUser = async function() {
    let emailInput = document.getElementById("emailInput");
    let passwordInput = document.getElementById("passwordInput");
    let errorTag = document.getElementById("authError");
    
    let email = emailInput ? emailInput.value.trim() : "";
    let password = passwordInput ? passwordInput.value : "";
    if(errorTag) errorTag.innerText = "";

    if(!email || !password) {
        if(errorTag) errorTag.innerText = "দয়া করে জিমেইল এবং পাসওয়ার্ড দিন!";
        return;
    }
    if(password.length < 6) {
        if(errorTag) errorTag.innerText = "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে!";
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // ইউজারের জন্য একটি ইউনিক ভার্চুয়াল নাম্বার তৈরি করা
        let vNumber = await generateUniqueVirtualNumber();

        await setDoc(doc(db, "users", user.uid), {
            email: email,
            virtualNumber: vNumber,
            balance: 1.00,
            status: "online",
            createdAt: new Date()
        });

        alert(`✅ রেজিস্ট্রেশন সফল! আপনার ভার্চুয়াল নম্বর: ${vNumber}`);
    } catch (error) {
        if(errorTag) errorTag.innerText = "ত্রুটি: " + error.message;
    }
}

window.loginUser = async function() {
    let emailInput = document.getElementById("emailInput");
    let passwordInput = document.getElementById("passwordInput");
    let errorTag = document.getElementById("authError");

    let email = emailInput ? emailInput.value.trim() : "";
    let password = passwordInput ? passwordInput.value : "";
    if(errorTag) errorTag.innerText = "";

    if(!email || !password) {
        if(errorTag) errorTag.innerText = "দয়া করে জিমেইল এবং পাসওয়ার্ড দিন!";
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        if(errorTag) errorTag.innerText = "লগইন ব্যর্থ: " + error.message;
    }
}

window.logoutUser = async function() {
    if (currentUserId) {
        await setDoc(doc(db, "users", currentUserId), { status: "offline" }, { merge: true });
    }
    await signOut(auth);
    window.showPage('loginPage');
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        currentUserEmail = user.email || "";
        
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                currentVirtualNumber = docSnap.data().virtualNumber || "----";
                currentBalanceValue = parseFloat(docSnap.data().balance) || 0;
                updateBalanceUI(currentBalanceValue);
                
                let emailElem = document.getElementById("menuUserEmail");
                if(emailElem) emailElem.innerText = `ID: ${user.email}\nআপনার নম্বর: ${currentVirtualNumber}`;
                
                // অনলাইন স্ট্যাটাস আপডেট
                await setDoc(docRef, { status: "online" }, { merge: true });
            }
        } catch (e) {
            console.log("User data fetch error:", e);
        }

        window.showPage('dashboardPage');
    } else {
        currentUserId = null;
        currentUserEmail = "";
        currentVirtualNumber = "";
        window.showPage('loginPage');
    }
});

function updateBalanceUI(amt) {
    let balElem = document.getElementById("userBalance");
    let recElem = document.getElementById("rechargeBalanceDisplay");
    let formatted = "৳ " + Number(amt).toFixed(2);
    if(balElem) balElem.innerText = formatted;
    if(recElem) recElem.innerText = formatted;
}

window.pressKey = function(val) { 
    let screen = document.getElementById('dialScreen');
    if(screen) screen.value += val; 
}

window.deleteDigit = function() {
    let screen = document.getElementById('dialScreen');
    if(screen) screen.value = screen.value.slice(0, -1);
}

window.clearScreen = function() {
    let screen = document.getElementById('dialScreen');
    if(screen) screen.value = "";
}

// নিজস্ব সিস্টেমে কল করার ফাংশন (ভার্চুয়াল নাম্বার দিয়ে)
window.makeCall = async function() {
    let screen = document.getElementById('dialScreen');
    let targetNumber = screen ? screen.value.trim() : "";
    
    if(targetNumber === "") {
        alert("দয়া করে একটি ভার্চুয়াল নম্বর ডায়াল করুন!");
        return;
    }

    if(targetNumber === currentVirtualNumber) {
        alert("আপনি নিজের নম্বরে কল করতে পারবেন না!");
        return;
    }

    let numDisplay = document.getElementById("callingNumberDisplay");
    if(numDisplay) numDisplay.innerText = targetNumber;
    window.showPage('callingPage');

    console.log('কল করা হচ্ছে নম্বরটিতে: ' + targetNumber);

    try {
        // ডাটাবেজ থেকে চেক করা যে এই ভার্চুয়াল নম্বরের কোনো ইউজার আছে কি না
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("virtualNumber", "==", targetNumber));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("দুঃখিত, এই নম্বরের কোনো ব্যবহারকারী পাওয়া যায়নি!");
            window.endCall();
            return;
        }

        let receiverData = null;
        querySnapshot.forEach((doc) => {
            receiverData = doc.data();
        });

        if (receiverData.status !== "online") {
            alert("ব্যবহারকারী বর্তমানে অফলাইনে আছেন!");
            window.endCall();
            return;
        }

        // মাইক্রোফোন পারমিশন নিয়ে WebRTC কল ইনিট করা
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log('মাইক্রোফোন চালু হয়েছে। কল সিগন্যাল পাঠানো হচ্ছে...');

    } catch (err) {
        console.log('কল এরর: ' + err.message);
        alert("কল সংযোগ করতে সমস্যা হয়েছে: " + err.message);
        window.endCall();
    }
}

window.endCall = function() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    let screen = document.getElementById('dialScreen');
    if(screen) screen.value = "";
    window.showPage('dashboardPage');
    console.log('কল কেটে দেওয়া হয়েছে।');
}
