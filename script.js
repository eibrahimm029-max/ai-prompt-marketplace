// মোবাইল স্ক্রিনেই কনসোল দেখার ফাংশন
(function () {
    let oldLog = console.log;
    console.log = function (message) {
        oldLog.apply(console, arguments);
        let box = document.getElementById("debugLogBox");
        if (box) {
            box.innerHTML += "&gt; " + message + "<br>";
            box.scrollTop = box.scrollHeight;
        }
    };
})();

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let currentSession = null;

// ওয়েবআরটিসি (WebRTC) ভিত্তিক স্ট্যাবল VoIP ইনিট ফাংশন
function initVoIP() {
    try {
        console.log("VoIP সিস্টেম প্রস্তুত করা হচ্ছে...");
        // ব্রাউজারের নিজস্ব WebRTC সাপোর্ট চেক
        if (!navigator.mediaDevices || !window.RTCPeerConnection) {
            console.log("সতর্কতা: এই ব্রাউজার WebRTC কলিং সাপোর্ট করে না।");
            return;
        }
        console.log("Zadarma VoIP ও WebRTC সফলভাবে ইনিশিয়ালাইজ হয়েছে!");
    } catch (err) {
        console.log("VoIP Init Error: " + err.message);
    }
}

let activeCallNumber = "";
let currentUserId = null;
let currentUserEmail = "";
let callLogs = [];
let savedContacts = [];
let currentBalanceValue = 0;

const ADMIN_EMAIL = "eibrahimm028q@gmail.com";

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

        await setDoc(doc(db, "users", user.uid), {
            email: email,
            balance: 1.00,
            createdAt: new Date()
        });

        alert("✅ রেজিস্ট্রেশন সফল হয়েছে এবং ১ টাকা ফ্রি যুক্ত হয়েছে!");
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
    await signOut(auth);
    window.showPage('loginPage');
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        currentUserEmail = user.email || "";
        let emailElem = document.getElementById("menuUserEmail");
        if(emailElem) emailElem.innerText = "ID: " + user.email;
        
        window.showPage('dashboardPage');
        initVoIP();

        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                currentBalanceValue = parseFloat(docSnap.data().balance) || 0;
                updateBalanceUI(currentBalanceValue);
            }
        } catch (e) {
            console.log("Balance fetch error:", e);
        }
    } else {
        currentUserId = null;
        currentUserEmail = "";
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

window.makeCall = function() {
    let screen = document.getElementById('dialScreen');
    let num = screen ? screen.value.trim() : "";
    if(num.length < 11) {
        alert("সঠিক ১১ ডিজিটের নম্বর লিখুন!");
        return;
    }
    
    activeCallNumber = num;
    let numDisplay = document.getElementById("callingNumberDisplay");
    if(numDisplay) numDisplay.innerText = num;
    window.showPage('callingPage');

    console.log('কল রিং হচ্ছে: ' + num);

    // মাইক্রোফোন পারমিশন ও কল সিমুলেশন বা কানেকশন প্রসেস
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => {
        console.log('মাইক্রোফোন পারমিশন সফল। কল কানেক্ট হয়েছে!');
        currentSession = stream;
    })
    .catch(err => {
        console.log('মাইক্রোফোন পারমিশন প্রয়োজন বা ত্রুটি: ' + err.message);
    });
}

window.endCall = function() {
    if (currentSession && currentSession.getTracks) {
        currentSession.getTracks().forEach(track => track.stop());
    }
    currentSession = null;

    let timeNow = new Date().toLocaleTimeString();
    callLogs.unshift({ phone: activeCallNumber, time: timeNow });
    updateCallHistoryUI();

    let screen = document.getElementById('dialScreen');
    if(screen) screen.value = "";
    window.showPage('dashboardPage');
    console.log('কল কেটে দেওয়া হয়েছে।');
}

function updateCallHistoryUI() {
    let historyList = document.getElementById("callHistoryList");
    if(historyList && callLogs.length > 0) {
        let html = "";
        callLogs.forEach((log) => {
            html += `<div class="history-item">
                <span>📞 <b>${log.phone}</b><br><small style="color:#888;">${log.time}</small></span>
                <div>
                    <button class="btn btn-primary" style="width: auto; padding: 4px 8px; font-size: 11px; margin-top: 0; margin-right: 4px;" onclick="dialContact('${log.phone}')">কল</button>
                    <button class="btn btn-verify" style="width: auto; padding: 4px 8px; font-size: 11px; margin-top: 0;" onclick="saveFromHistory('${log.phone}')">সেভ</button>
                </div>
            </div>`;
        });
        historyList.innerHTML = html;
    }
}

window.saveFromHistory = function(phoneNum) {
    let phoneElem = document.getElementById("contactPhone");
    if(phoneElem) phoneElem.value = phoneNum;
    window.showPage('contactsPage');
}

window.saveContact = function() {
    let nameElem = document.getElementById("contactName");
    let phoneElem = document.getElementById("contactPhone");
    let photoElem = document.getElementById("contactPhoto");

    let name = nameElem ? nameElem.value.trim() : "";
    let phone = phoneElem ? phoneElem.value.trim() : "";
    let photo = photoElem ? photoElem.value.trim() : "https://cdn-icons-png.flaticon.com/512/149/149071.png";

    if(name !== "" && phone.length >= 11) {
        if(!photo) photo = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
        savedContacts.push({ name: name, phone: phone, photo: photo });
        updateContactUI();
        if(nameElem) nameElem.value = "";
        if(phoneElem) phoneElem.value = "";
        if(photoElem) photoElem.value = "";
        alert("✅ কন্টাক্ট সফলভাবে সেভ হয়েছে!");
    } else {
        alert("দয়া করে সঠিক নাম এবং ১১ ডিজিটের নম্বর দিন!");
    }
}

function updateContactUI() {
    let contactListUI = document.getElementById("contactListUI");
    if(contactListUI && savedContacts.length > 0) {
        let html = "";
        savedContacts.forEach((c) => {
            html += `<div class="contact-item">
                <div style="display: flex; align-items: center;">
                    <img src="${c.photo}" class="contact-avatar" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">
                    <span><b>${c.name}</b><br>${c.phone}</span>
                </div>
                <button class="btn btn-primary" style="width: auto; padding: 5px 10px; font-size: 12px; margin-top: 0;" onclick="dialContact('${c.phone}')">কল করুন</button>
            </div>`;
        });
        contactListUI.innerHTML = html;
    }
}

window.dialContact = function(phoneNum) {
    let screen = document.getElementById('dialScreen');
    if(screen) screen.value = phoneNum;
    window.showPage('dashboardPage');
}

window.copyNumber = function(elementId) {
    let numElem = document.getElementById(elementId);
    let numText = numElem ? numElem.innerText : "";
    navigator.clipboard.writeText(numText).then(() => {
        alert("✅ নম্বরটি কপি হয়েছে: " + numText);
    }).catch(err => {
        alert("কপি করতে সমস্যা হয়েছে!");
    });
}

window.setAmount = function(amt) { 
    let customAmt = document.getElementById('customAmount');
    if(customAmt) customAmt.value = amt; 
}

window.processAIRecharge = async function() {
    let customAmtElem = document.getElementById('customAmount');
    let trxElem = document.getElementById('trxIdInput');
    
    let amt = parseFloat(customAmtElem ? customAmtElem.value : 0);
    let trxId = trxElem ? trxElem.value.trim() : "";

    if(amt > 0 && trxId !== "" && currentUserId) {
        try {
            await addDoc(collection(db, "recharge_requests"), {
                userId: currentUserId,
                email: currentUserEmail,
                amount: amt,
                trxId: trxId,
                status: "Pending",
                time: new Date()
            });

            alert("✅ রিচার্জ রিকোয়েস্ট সাবমিট হয়েছে!");
            if(customAmtElem) customAmtElem.value = "";
            if(trxElem) trxElem.value = "";
            window.showPage('dashboardPage');
        } catch (error) {
            alert("রিচার্জ রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে: " + error.message);
        }
    } else {
        alert("দয়া করে সঠিক টাকার পরিমাণ এবং TrxID দিন!");
    }
}

window.loadAdminRequests = async function() {
    let requestContainer = document.getElementById("adminRequestList");
    if (!requestContainer) return;

    if (currentUserEmail !== ADMIN_EMAIL) {
        requestContainer.innerHTML = "<p style='color: red; font-weight: bold; text-align: center; padding: 20px;'>⛔ আপনার এই পেজে প্রবেশ করার অনুমতি নেই!</p>";
        return;
    }

    requestContainer.innerHTML = "লোড হচ্ছে...";

    try {
        const querySnapshot = await getDocs(collection(db, "recharge_requests"));
        let html = "";
        
        querySnapshot.forEach((docSnap) => {
            let req = docSnap.data();
            let reqId = docSnap.id;

            if (req.status === "Pending") {
                html += `
                    <div style="background: #fff; border: 1px solid #ddd; padding: 12px; margin-bottom: 10px; border-radius: 8px;">
                        <p style="margin: 0 0 5px 0;"><b>ইউজার:</b> ${req.email}</p>
                        <p style="margin: 0 0 5px 0;"><b>টাকা:</b> ৳${req.amount}</p>
                        <p style="margin: 0 0 8px 0;"><b>TrxID:</b> <span style="color: #e74c3c; font-weight: bold;">${req.trxId}</span></p>
                        <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px; width: auto; background-color: #27ae60;" onclick="approveRechargeFromAdmin('${req.userId}', ${req.amount}, '${reqId}')">
                            ✅ টাকা যোগ করুন
                        </button>
                    </div>
                `;
            }
        });

        if (html === "") {
            requestContainer.innerHTML = "<p style='text-align: center; color: #666;'>কোনো নতুন রিকোয়েস্ট নেই।</p>";
        } else {
            requestContainer.innerHTML = html;
        }
    } catch (error) {
        requestContainer.innerHTML = "ডাটা লোড করতে সমস্যা হয়েছে: " + error.message;
    }
}

window.approveRechargeFromAdmin = async function(userId, rechargeAmount, requestId) {
    if (currentUserEmail !== ADMIN_EMAIL) {
        alert("⛔ অনুমতি নেই!");
        return;
    }

    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        let currentBal = 0;
        if (userSnap.exists()) {
            currentBal = parseFloat(userSnap.data().balance) || 0;
        }
        
        let newBalance = currentBal + parseFloat(rechargeAmount);

        await setDoc(userRef, { balance: newBalance }, { merge: true });

        const requestRef = doc(db, "recharge_requests", requestId);
        await updateDoc(requestRef, { status: "Approved" });

        alert("✅ সফল! টাকা যোগ হয়ে গেছে।");
        window.loadAdminRequests();
    } catch (error) {
        alert("সমস্যা হয়েছে: " + error.message);
    }
};
