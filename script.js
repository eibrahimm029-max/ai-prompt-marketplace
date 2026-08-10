import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
let activeCallNumber = "";
let localStream = null;
let savedContacts = [];

const ADMIN_EMAIL = "eibrahimm028q@gmail.com";

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
                let currentBalanceValue = parseFloat(docSnap.data().balance) || 0;
                
                let balElem = document.getElementById("userBalance");
                if(balElem) balElem.innerText = "৳ " + Number(currentBalanceValue).toFixed(2);

                let vNumElem = document.getElementById("myVirtualNumber");
                if(vNumElem) vNumElem.innerText = currentVirtualNumber;
                
                let emailElem = document.getElementById("menuUserEmail");
                if(emailElem) emailElem.innerText = `ID: ${user.email}`;
                
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

    activeCallNumber = targetNumber;
    let numDisplay = document.getElementById("callingNumberDisplay");
    if(numDisplay) numDisplay.innerText = targetNumber;
    window.showPage('callingPage');

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
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

window.endCall = function() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    let screen = document.getElementById('dialScreen');
    if(screen) screen.value = "";
    window.showPage('dashboardPage');
}

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

    if(name !== "" && phone.length >= 4) {
        savedContacts.push({ name: name, phone: phone });
        alert("✅ কন্টাক্ট সেভ হয়েছে!");
        window.showPage('dashboardPage');
    } else {
        alert("সঠিক তথ্য দিন!");
    }
}

window.loadAdminRequests = async function() {
    let requestContainer = document.getElementById("adminRequestList");
    if (!requestContainer) return;
    if (currentUserEmail !== ADMIN_EMAIL) {
        requestContainer.innerHTML = "<p style='color: red; text-align: center;'>⛔ অনুমতি নেই!</p>";
        return;
    }
    requestContainer.innerHTML = "<p style='text-align: center;'>কোনো নতুন রিকোয়েস্ট নেই।</p>";
}
