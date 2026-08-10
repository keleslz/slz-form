/**
 * Suite de non-régression de la démo, pilotée dans un vrai navigateur.
 *
 *   BASE_URL        cible (défaut http://localhost:5173)
 *   SCREENSHOT_DIR  si défini, écrit une capture par onglet
 *   CHROMIUM_PATH   binaire Chromium à utiliser, quand l'environnement en
 *                   fournit déjà un et qu'on ne veut pas en télécharger un
 *
 * Sort en code 1 dès qu'une assertion échoue, pour servir de garde en CI.
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH;

let failures = 0;
const consoleErrors = [];

function check(label, ok, extra = "") {
    if (!ok) failures += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
}

async function waitForServer(url, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // pas encore prêt
        }
        if (Date.now() > deadline) throw new Error(`Serveur injoignable sur ${url}`);
        await new Promise((resolve) => setTimeout(resolve, 400));
    }
}

await waitForServer(BASE_URL);

const browser = await chromium.launch(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 1300 } });
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const field = (label) =>
    page.locator(".field").filter({ has: page.locator(".field__label", { hasText: label }) }).first();
const flags = async (label) =>
    (await field(label).locator(".field__flags .chip").allTextContents()).filter((f) => !f.startsWith("↻"));
const renders = async (label) =>
    Number((await field(label).locator(".chip--renders").textContent()).replace("↻ ", ""));
const tab = (name) => page.locator(".tab", { hasText: name });
const overlayOpen = () =>
    page.locator(".overlay").first().evaluate((el) => el.classList.contains("is-open"));

await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

console.log("── onglets ──");
check("3 onglets rendus", (await page.locator(".tab").count()) === 3);
check("onglet 3 désactivé", (await page.locator(".tab:disabled").count()) === 1);
check("onglet moteur actif par défaut",
    (await page.locator(".tab.is-active .tab__label").textContent()) === "slz-form");

console.log("\n── onglet 1 : slz-form ──");
await page.waitForTimeout(120);
check("Marque `loading` au montage", (await flags("Marque")).includes("loading"), (await flags("Marque")).join(","));
await page.waitForTimeout(1400);
check("Marque a ses options", (await field("Marque").locator("option").count()) === 5);
check("Prefill rempli, champ pristine",
    (await field("Référence client").locator("input").inputValue()) === "CUST-42-9013"
    && (await flags("Référence client")).includes("pristine"));

await field("Marque").locator("select").selectOption("peugeot");
await page.waitForTimeout(1000);
check("Select dépendant rechargé", (await field("Modèle").locator("option").count()) === 4);

check("Champ conditionnel masqué", (await field("Précisez la marque").count()) === 0);
await field("Marque").locator("select").selectOption("other");
await page.waitForTimeout(900);
check("Champ conditionnel affiché (flag invisible)", (await field("Précisez la marque").count()) === 1);

check("Date verrouillée avant consentement", (await flags("Date de livraison")).includes("locked"));
await field("J'accepte les conditions").locator("input").check();
await page.waitForTimeout(250);
check("Date déverrouillée après consentement", !(await flags("Date de livraison")).includes("locked"));

await field("Email").locator("input").fill("pas-un-email");
await page.waitForTimeout(200);
check("Email invalide → flag error", (await flags("Email")).includes("error"));

const slzBefore = { comment: await renders("Commentaire"), mileage: await renders("Kilométrage") };
await field("Nom complet").locator("input").fill("Ada Lovelace");
await page.waitForTimeout(250);
const slzAfter = { comment: await renders("Commentaire"), mileage: await renders("Kilométrage") };
const slzDelta = (slzAfter.comment - slzBefore.comment) + (slzAfter.mileage - slzBefore.mileage);
check("Taper n'affecte pas les autres champs", slzDelta === 0, `Δ rendus voisins = ${slzDelta}`);

console.log("\n── overlay debugger ──");
check("Overlay fermé au départ", !(await overlayOpen()));
await page.locator(".overlay__toggle").click();
await page.waitForTimeout(350);
check("Overlay ouvert par le toggle", await overlayOpen());
check("Overlay liste les champs", (await page.locator(".debug__table tr").count()) === 20,
    `${await page.locator(".debug__table tr").count()} lignes`);
if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/tab-slz.png`, fullPage: true });
await page.locator(".overlay__toggle").click();
await page.waitForTimeout(300);
check("Overlay refermé", !(await overlayOpen()));

console.log("\n── asynchrone différé ──");
// Une salve de frappe ne doit déclencher qu'un seul appel réseau.
const apiCalls = async () => {
    const opened = await overlayOpen();
    if (!opened) await page.locator(".overlay__toggle").click();
    await page.waitForTimeout(150);
    const text = await page.getByTestId("api-calls").textContent();
    if (!opened) { await page.locator(".overlay__toggle").click(); await page.waitForTimeout(250); }
    return text;
};

const username = field("Identifiant").locator("input");
await username.click();
for (const ch of "adalovelace") { await username.press(ch); await page.waitForTimeout(45); }
await page.waitForTimeout(120);
check("`loading` pendant la fenêtre d'attente", (await flags("Identifiant")).includes("loading"),
    (await flags("Identifiant")).join(","));
await page.waitForTimeout(1400);
check("identifiant libre → valid", (await flags("Identifiant")).includes("valid"),
    (await flags("Identifiant")).join(","));

await username.fill("");
await username.pressSequentially("ada", { delay: 40 });
await page.waitForTimeout(1400);
check("identifiant pris → error", (await flags("Identifiant")).includes("error"),
    (await flags("Identifiant")).join(","));

// lookup : le code postal remplit la ville, sans marquer le champ touché
const postcode = field("Code postal").locator("input");
await postcode.click();
for (const ch of "75001") { await postcode.press(ch); await page.waitForTimeout(45); }
await page.waitForTimeout(200);
check("la ville est `loading` + `locked` pendant l'attente",
    (await flags("Ville")).includes("loading") && (await flags("Ville")).includes("locked"),
    (await flags("Ville")).join(","));
await page.waitForTimeout(1500);
check("la ville a été écrite", (await field("Ville").locator("input").inputValue()) === "Paris",
    await field("Ville").locator("input").inputValue());
check("l'écriture laisse la ville `pristine`", (await flags("Ville")).includes("pristine"),
    (await flags("Ville")).join(","));

// champ de recherche : loader, mais jamais verrouillé
const searchInput = field("Recherche de ville").locator("input");
await searchInput.click();
for (const ch of "bord") { await searchInput.press(ch); await page.waitForTimeout(45); }
await page.waitForTimeout(120);
const searchFlags = await flags("Recherche de ville");
check("le champ de recherche est `loading`", searchFlags.includes("loading"), searchFlags.join(","));
check("mais il n'est jamais verrouillé", !searchFlags.includes("locked"), searchFlags.join(","));
check("il reste éditable pendant l'appel", await searchInput.isEnabled());
await page.waitForTimeout(900);
check("les suggestions sont arrivées",
    (await page.getByTestId("suggestions").locator("option").count()) === 1,
    `${await page.getByTestId("suggestions").locator("option").count()} suggestion(s)`);
check("la saisie n'a pas été touchée", (await searchInput.inputValue()) === "bord",
    await searchInput.inputValue());

const counts = await apiCalls();
const parsed = counts.match(/(\d+) identifiant · (\d+) ville/);
const usernameCalls = Number(parsed?.[1] ?? -1);
const cityCalls = Number(parsed?.[2] ?? -1);
// Sans debounce, taper « adalovelace » puis « ada » coûterait ~14 appels.
check("2 salves de frappe → au plus 3 appels d'identifiant", usernameCalls >= 1 && usernameCalls <= 3, counts);
check("1 code postal saisi → au plus 2 appels de ville", cityCalls >= 1 && cityCalls <= 2, counts);

console.log("\n── onglet 2 : useState ──");
await tab("useState").click();
await page.waitForTimeout(120);
check("Aucun flag affiché (baseline)", (await flags("Nom complet")).length === 0);
await page.waitForTimeout(1500);
check("Marque a ses options", (await field("Marque").locator("option").count()) === 5);
check("Prefill rempli", (await field("Référence client").locator("input").inputValue()) === "CUST-42-9013");

await field("Marque").locator("select").selectOption("peugeot");
await page.waitForTimeout(1100);
check("Select dépendant rechargé", (await field("Modèle").locator("option").count()) === 4);

check("Champ conditionnel masqué", (await field("Précisez la marque").count()) === 0);
await field("Marque").locator("select").selectOption("other");
await page.waitForTimeout(1000);
check("Champ conditionnel affiché", (await field("Précisez la marque").count()) === 1);

const lockedBefore = await field("Date de livraison").locator("input").isDisabled();
await field("J'accepte les conditions").locator("input").check();
await page.waitForTimeout(200);
const lockedAfter = await field("Date de livraison").locator("input").isDisabled();
check("Date verrouillée puis déverrouillée", lockedBefore && !lockedAfter);

await field("Email").locator("input").fill("pas-un-email");
await page.waitForTimeout(200);
check("Email invalide → message",
    (await field("Email").locator(".field__error").textContent()) === "Adresse email invalide");

check("Debugger présent sur la baseline aussi", (await page.locator(".overlay__toggle").count()) === 1);
await page.locator(".overlay__toggle").click();
await page.waitForTimeout(350);
check("Overlay baseline ouvert", await overlayOpen());
check("Overlay baseline liste les champs", (await page.locator(".debug__table tr").count()) === 20);
if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/tab-usestate.png`, fullPage: true });

const usBefore = { comment: await renders("Commentaire"), mileage: await renders("Kilométrage") };
await field("Nom complet").locator("input").fill("Ada Lovelace");
await page.waitForTimeout(250);
const usAfter = { comment: await renders("Commentaire"), mileage: await renders("Kilométrage") };
const usDelta = (usAfter.comment - usBefore.comment) + (usAfter.mileage - usBefore.mileage);

console.log(`\nINFO  Δ rendus des champs voisins — slz-form: ${slzDelta}   useState: ${usDelta}`);
check("Le moteur isole strictement mieux que la baseline", slzDelta < usDelta,
    `${slzDelta} < ${usDelta}`);

check("Aucune erreur console", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

await browser.close();

console.log(failures === 0 ? "\n✅ toutes les assertions passent" : `\n❌ ${failures} assertion(s) en échec`);
process.exit(failures === 0 ? 0 : 1);
