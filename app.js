


let scanner = new Html5Qrcode("reader");
let scannerRunning = false;
let processing = false;

// ==========================================
// GESTION DES BILLETS UTILISES
// ==========================================

const STORAGE_KEY = "usedTickets";

// Récupérer la base de données
function getUsedTickets() {

    return JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
    );
}

// Enregistrer un nouveau billet
function saveUsedTicket(id) {

    const used = getUsedTickets();

    // Vérifier une dernière fois qu'il n'existe pas
    if (used[id]) {
        return false;
    }

    // Enregistrer la date et l'heure du scan
    used[id] = new Date().toISOString();

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(used)
    );

    updateStatistics();

    return true;
}

// Mettre à jour les statistiques
function updateStatistics() {

    const used = getUsedTickets();

    document.getElementById("count").textContent =
        Object.keys(used).length;
}


// ==========================================
// VERIFICATION DU HASH
// ==========================================

async function getHash(text) {

    const data = new TextEncoder().encode(text);

    const hash = await crypto.subtle.digest(
        "SHA-256",
        data
    );

    return Array.from(new Uint8Array(hash))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

// ==========================================
// VALIDATION DU QR CODE
// ==========================================

async function validateQRCode(result) {

    if (!result) {
        return {
            valid: false,
            reason: "QR Code illisible"
        };
    }

    const elements = {};

    for (const line of result.split("\n")) {

        const separator = line.indexOf(": ");

        if (separator !== -1) {

            const key = line.substring(0, separator);
            const value = line.substring(separator + 2);

            elements[key] = value;
        }
    }

    const fields = [
        "ID",
        "Prénom",
        "Nom",
        "Classe",
        "Age",
        "Security String"
    ];

    for (const field of fields) {

        if (!(field in elements)) {
            return {
                valid: false,
                reason: "Informations manquantes"
            };
        }
    }

    const supposedText =
        `ID: ${elements["ID"]}\n` +
        `Prénom: ${elements["Prénom"]}\n` +
        `Nom: ${elements["Nom"]}\n` +
        `Classe: ${elements["Classe"]}\n` +
        `Age: ${elements["Age"]}\n` +
        `Security String: `;

    const expectedHash = await getHash(supposedText);

    if (elements["Security String"] !== expectedHash) {
        return {
            valid: false,
            reason: "Signature invalide"
        };
    }

    return {
        valid: true,
        data: elements
    };
}

// ==========================================
// AFFICHAGE DU RESULTAT
// ==========================================

function displayResult(valid, data, reason = "") {

    const result = document.getElementById("result");

    result.classList.remove("hidden", "valid", "invalid");

    result.classList.add(valid ? "valid" : "invalid");

    document.getElementById("result-title").textContent =
        valid ? "BILLET VALIDE" : "BILLET REFUSE";

    if (valid) {

        document.getElementById("result-name").textContent =
            data["Prénom"] + " " + data["Nom"];

        document.getElementById("result-class").textContent =
            "Classe : " + data["Classe"];

        document.getElementById("result-age").textContent =
            "Âge : " + data["Age"];

    } else {

        document.getElementById("result-name").textContent =
            reason;

        document.getElementById("result-class").textContent = "";
        document.getElementById("result-age").textContent = "";
    }
}

// ==========================================
// LECTURE DU QR CODE
// ==========================================


async function onScanSuccess(decodedText) {

    if (processing) return;

    processing = true;

    try {

        await scanner.stop();
        scannerRunning = false;

        // Vérifier l'authenticité du QR Code
        const response = await validateQRCode(decodedText);

        if (!response.valid) {

            displayResult(
                false,
                null,
                response.reason
            );

        } else {

            const data = response.data;
            const id = String(data["ID"]);

            const used = getUsedTickets();

            // Vérifier si le billet a déjà été utilisé
            if (used[id]) {

                displayAlreadyUsed(
                    data,
                    used[id]
                );

            } else {

                // Enregistrer le nouveau billet
                const saved = saveUsedTicket(id);

                if (saved) {

                    displayResult(true, data);

                } else {

                    displayAlreadyUsed(
                        data,
                        getUsedTickets()[id]
                    );
                }
            }
        }

    } catch (error) {

        console.error(error);

        displayResult(
            false,
            null,
            "Erreur lors de la vérification"
        );
    }
}


function displayAlreadyUsed(data, timestamp) {

    const result = document.getElementById("result");

    result.classList.remove("hidden", "valid", "invalid");
    result.classList.add("invalid");

    document.getElementById("result-title").textContent =
        "BILLET DÉJÀ SCANNÉ";

    document.getElementById("result-name").textContent =
        data["Prénom"] + " " + data["Nom"];

    document.getElementById("result-class").textContent =
        "Ce participant est déjà entré.";

    const date = new Date(timestamp);

    document.getElementById("result-age").textContent =
        "Premier scan : " + date.toLocaleString("fr-FR");
}



// ==========================================
// ACTIVATION DE LA CAMERA
// ==========================================

async function startScanner() {

    if (scannerRunning) return;

    document.getElementById("result").classList.add("hidden");

    document.getElementById("status").textContent =
        "Initialisation de la caméra...";

    try {

        await scanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: {
                    width: 250,
                    height: 250
                }
            },
            onScanSuccess
        );

        scannerRunning = true;

        document.getElementById("status").textContent =
            "Présente un QR Code devant la caméra";

        document.getElementById("start-button").classList.add("hidden");

    } catch (error) {

        document.getElementById("status").textContent =
            "Impossible d'activer la caméra : " + error;

    }
}

// ==========================================
// NOUVEAU SCAN
// ==========================================

function resetScanner() {

    processing = false;

    document.getElementById("result").classList.add("hidden");

    document.getElementById("start-button").classList.remove("hidden");

    document.getElementById("status").textContent =
        "Prêt à scanner";

    updateStatistics();
}

// Initialisation
updateStatistics();
