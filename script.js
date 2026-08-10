import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, where, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let currentMobileNumber = "";
let currentUserId = null;
let currentCallDocId = null;
let localStream = null;
let callListenerUnsubscribe = null;
let savedContacts = [];

const ADMIN_EMAIL = "01800000000@rkcvoip.com"; // এডমিন নম্বর ভিত্তিক

// ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর চেক করার রেগুলার এক্সপ্রেশন
function isValidBDMobile(number) {
    const bdRegex = /^01[3-9]\d{8}$/;
    return bdRegex.test(number);
}

// পেজ পরিবর্তন করার ফাংশন
window.showPage = function(pageId) {
    if(pageId === 'rechargePage') {
        alert("⛔ এই মুহূর্তে রিচার্জ পেজে প্রবেশের অনুমতি নেই!");
        return;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    let targetPage = document.getElementById(pageId);
    if(targetPage) targetPage.classList.add('active');

    if(pageId === 'adminPage') {
        window.loadAdminRequests();
    }
    if(pageId === 'callHistoryPage') {
        window.loadCallHistory();
    }
}

// মেনু টগল ফাংশন
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

// ১১ ডিজিটের মোবাইল নম্বর দিয়ে রেজিস্ট্রেশন
window.registerUser = async function() {
    let phoneInput = document.getElementById("emailInput"); // HTML-এর emailInput আইডি ব্যবহার করা হয়েছে
    let passwordInput = document.getElementById("passwordInput");
    let errorTag = document.getElementById("authError");
    
    let phone = phoneInput ? phoneInput.value.trim() : "";
    let password = passwordInput ? passwordInput.value : "";
    if(errorTag) errorTag.innerText = "";

    if(!isValidBDMobile(phone)) {
        if(errorTag) errorTag.innerText = "দয়া করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন! (যেমন: 01712345678)";
        return;
    }
    if(password.length < 6) {
        if(errorTag) errorTag.innerText = "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে!";
        return;
    }

    let fakeEmail = phone + "@rkcvoip.com";

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            mobile: phone,
            balance: 10.00,
            status: "online",
            createdAt: new Date()
        });

        alert(`✅ রেজিস্ট্রেশন সফল! আপনার মোবাইল নম্বর: ${phone}`);
    } catch (error) {
        if(errorTag) errorTag.innerText = "ত্রুটি: " + error.message;
    }
}

// ১১ ডিজিটের মোবাইল নম্বর দিয়ে লগইন
window.loginUser = async function() {
    let phoneInput = document.getElementById("emailInput");
    let passwordInput = document.getElementById("passwordInput");
    let errorTag = document.getElementById("authError");

    let phone = phoneInput ? phoneInput.value.trim() : "";
    let password = passwordInput ? passwordInput.value : "";
    if(errorTag) errorTag.innerText = "";

    if(!isValidBDMobile(phone)) {
        if(errorTag) errorTag.innerText = "দয়া করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন!";
        return;
    }

    let fakeEmail = phone + "@rkcvoip.com";

    try {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
    } catch (error) {
        if(errorTag) errorTag.innerText = "লগইন ব্যর্থ: " + error.message;
    }
}

// লগআউট
window.logoutUser = async function() {
    if (callListenerUnsubscribe) callListenerUnsubscribe();
    await signOut(auth);
    window.showPage('loginPage');
}

// অথেন্টিকেশন স্টেট ট্র্যাক করা
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        currentMobileNumber = user.email.split('@')[0];
        
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                let currentBalanceValue = parseFloat(docSnap.data().balance) || 0;
                
                let balElem = document.getElementById("userBalance");
                if(balElem) balElem.innerText = "৳ " + Number(currentBalanceValue).toFixed(2);

                let vNumElem = document.getElementById("myVirtualNumber");
                if(vNumElem) vNumElem.innerText = currentMobileNumber;
                
                let emailElem = document.getElementById("menuUserEmail");
                if(emailElem) emailElem.innerText = `নম্বর: ${currentMobileNumber}`;
                
                await setDoc(docRef, { status: "online" }, { merge: true });

                // ইনস্ট্যান্ট কল শোনার জন্য রিয়েল-টাইম লিসেনার চালু করা
                listenForIncomingCalls(currentMobileNumber);
            }
        } catch (e) {
            console.log("User data fetch error:", e);
        }

        window.showPage('dashboardPage');
    } else {
        if (callListenerUnsubscribe) callListenerUnsubscribe();
        currentUserId = null;
        currentMobileNumber = "";
        window.showPage('loginPage');
    }
});

// ১ সেকেন্ডের মধ্যে ইনস্ট্যান্ট ইনকামিং কল সিগন্যালিং
function listenForIncomingCalls(myNumber) {
    if (callListenerUnsubscribe) callListenerUnsubscribe();

    const q = query(
        collection(db, "active_calls"), 
        where("receiverNumber", "==", myNumber),
        where("status", "==", "ringing")
    );

    callListenerUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                let callData = change.doc.data();
                currentCallDocId = change.doc.id;
                showIncomingCallAlert(callData.callerNumber);
            }
        });
    });
}

function showIncomingCallAlert(callerNum) {
    let confirmCall = confirm(`📞 ${callerNum} থেকে একটি কল এসেছে। রিসিভ করতে চান?`);
    if (confirmCall) {
        window.acceptCall();
    } else {
        window.rejectIncomingCall();
    }
}

window.acceptCall = async function() {
    if (currentCallDocId) {
        await updateDoc(doc(db, "active_calls", currentCallDocId), { status: "connected" });
    }
    window.showPage('callingPage');
    let numDisplay = document.getElementById("callingNumberDisplay");
    if(numDisplay) numDisplay.innerText = "কল কানেক্টেড!";
}

window.rejectIncomingCall = async function() {
    if (currentCallDocId) {
        await updateDoc(doc(db, "active_calls", currentCallDocId), { status: "rejected" });
        currentCallDocId = null;
    }
    window.showPage('dashboardPage');
}

// ডায়ালপ্যাড কন্ট্রোল
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

// সরাসরি ১১ ডিজিটের নম্বরে কল করার লজিক
window.makeCall = async function() {
    let screen = document.getElementById('dialScreen');
    let targetNumber = screen ? screen.value.trim() : "";
    
    if(!isValidBDMobile(targetNumber)) {
        alert("দয়া করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর ডায়াল করুন! (যেমন: 01712345678)");
        return;
    }

    if(targetNumber === currentMobileNumber) {
        alert("আপনি নিজের নম্বরে কল করতে পারবেন না!");
        return;
    }

    let numDisplay = document.getElementById("callingNumberDisplay");
    if(numDisplay) numDisplay.innerText = targetNumber;
    window.showPage('callingPage');

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        // ফায়ারবেসে দ্রুত রিংইং সিগন্যাল পাঠানো
        const callDocRef = await addDoc(collection(db, "active_calls"), {
            callerNumber: currentMobileNumber,
            receiverNumber: targetNumber,
            status: "ringing",
            time: new Date()
        });
        currentCallDocId = callDocRef.id;

        // কল হিস্ট্রি সেভ করা
        if(currentUserId) {
            await addDoc(collection(db, "call_logs"), {
                userId: currentUserId,
                targetPhone: targetNumber,
                time: new Date()
            });
        }
    } catch (err) {
        alert("মাইক্রোফোন পারমিশন প্রয়োজন বা ত্রুটি: " + err.message);
        window.endCall();
    }
}

window.endCall = async function() {
    if (currentCallDocId) {
        try {
            await updateDoc(doc(db, "active_calls", currentCallDocId), { status: "ended" });
        } catch(e) {}
        currentCallDocId = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    let screen = document.getElementById('dialScreen');
    if(screen) screen.value = "";
    window.showPage('dashboardPage');
}

// কল হিস্ট্রি লোড করা
window.loadCallHistory = async function() {
    let historyList = document.getElementById("callHistoryList");
    if(!historyList || !currentUserId) return;

    historyList.innerHTML = "<p style='text-align: center; color: #666;'>লোড হচ্ছে...</p>";

    try {
        const q = query(collection(db, "call_logs"), where("userId", "==", currentUserId));
        const querySnapshot = await getDocs(q);
        
        let html = "";
        if (querySnapshot.empty) {
            historyList.innerHTML = "<p style='text-align: center; color: #666; font-size: 13px;'>কোনো কল রেকর্ড নেই।</p>";
            return;
        }

        querySnapshot.forEach((doc) => {
            let log = doc.data();
            let timeString = log.time ? new Date(log.time.seconds * 1000).toLocaleString() : "অজানা সময়";
            html += `<div class="history-item">
                <span>📞 <b>${log.targetPhone}</b><br><small style="color:#888;">${timeString}</small></span>
                <button class="btn btn-primary" style="width: auto; padding: 4px 8px; font-size: 11px; margin-top: 0;" onclick="dialContact('${log.targetPhone}')">কল</button>
            </div>`;
        });
        historyList.innerHTML = html;
    } catch (error) {
        historyList.innerHTML = "<p style='text-align: center; color: red;'>হিস্ট্রি লোড করতে সমস্যা হয়েছে।</p>";
    }
}

window.dialContact = function(phoneNum) {
    let screen = document.getElementById('dialScreen');
    if(screen) screen.value = phoneNum;
    window.showPage('dashboardPage');
}

window.saveContact = function() {
    let nameElem = document.getElementById("contactName");
    let phoneElem = document.getElementById("contactPhone");
    let name = nameElem ? nameElem.value.trim() : "";
    let phone = phoneElem ? phoneElem.value.trim() : "";

    if(name !== "" && isValidBDMobile(phone)) {
        savedContacts.push({ name: name, phone: phone });
        alert("✅ কন্টাক্ট সেভ হয়েছে!");
        window.showPage('dashboardPage');
    } else {
        alert("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন!");
    }
}

window.loadAdminRequests = async function() {
    let requestContainer = document.getElementById("adminRequestList");
    if (!requestContainer) return;
    requestContainer.innerHTML = "<p style='text-align: center;'>কোনো নতুন রিকোয়েস্ট নেই।</p>";
                }
        
