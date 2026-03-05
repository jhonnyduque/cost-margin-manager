const url = "https://lvbbbviaxdiaqmzxdlwo.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2YmJidmlheGRpYXFtenhkbHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODI4NTAsImV4cCI6MjA4Njg1ODg1MH0.Vi8vI6ZGmKw4SpvW-3Ch0hCZOn4co71_4quE_oorDjQ";

async function truth() {
    console.log("--- JUEZ SUPABASE: LA VERDAD ---");

    const plansRes = await fetch(url + "subscription_plans?select=slug,monthly_price_cents", {
        headers: { "apikey": key, "Authorization": "Bearer " + key }
    });
    const plans = await plansRes.json();
    console.log("\nPLANES EN DB:");
    console.table(plans);

    const companiesRes = await fetch(url + "companies?select=name,subscription_tier,subscription_status&subscription_status=in.(active,trialing)", {
        headers: { "apikey": key, "Authorization": "Bearer " + key }
    });
    const companies = await companiesRes.json();
    console.log("\nEMPRESAS ACTIVAS/TRIAL EN DB:");
    console.table(companies);
}

truth();
