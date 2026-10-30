const INACTIVITY_LIMIT = 2 * 60 * 1000;
const CHECK_INTERVAL = 5000;

let lastActivity = Date.now();
let loggingOut = false;
let sessionChecker = null;

const logoutButton = document.getElementById("logoutButton");
const welcomeTitle = document.getElementById("welcomeTitle");

async function logout() {
    if (loggingOut) return;

    loggingOut = true;

    if (sessionChecker) {
        clearInterval(sessionChecker);
    }

    if (logoutButton) {
        logoutButton.disabled = true;
        logoutButton.textContent = "Logging out...";
    }

    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin"
        });
    } catch (error) {
        console.error("Logout request failed.");
    } finally {
        window.location.replace("/login");
    }
}

function updateActivity() {
    if (!loggingOut) {
        lastActivity = Date.now();
    }
}

async function checkSession() {
    if (loggingOut) return;

    if (Date.now() - lastActivity >= INACTIVITY_LIMIT) {
        await logout();
        return;
    }

    try {
        const response = await fetch("/api/auth/session", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            await logout();
            return;
        }

        const data = await response.json();

        if (data.user && data.user.name && welcomeTitle) {
            welcomeTitle.textContent =
                `Welcome back, ${data.user.name}.`;
        }
    } catch (error) {
        // A temporary network error should not immediately
        // destroy a valid session. Retry on the next interval.
        console.error("Session check failed.");
    }
}

[
    "mousemove",
    "mousedown",
    "keydown",
    "click",
    "scroll",
    "touchstart"
].forEach((eventName) => {
    document.addEventListener(eventName, updateActivity, {
        passive: true
    });
});

if (logoutButton) {
    logoutButton.addEventListener("click", logout);
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        if (Date.now() - lastActivity >= INACTIVITY_LIMIT) {
            logout();
        } else {
            checkSession();
        }
    }
});

window.addEventListener("pageshow", () => {
    if (Date.now() - lastActivity >= INACTIVITY_LIMIT) {
        logout();
    } else {
        checkSession();
    }
});

async function initializeDashboard() {
    await checkSession();

    if (!loggingOut) {
        sessionChecker = setInterval(checkSession, CHECK_INTERVAL);
    }
}

initializeDashboard();