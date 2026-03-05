const url = "https://lvbbbviaxdiaqmzxdlwo.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2YmJidmlheGRpYXFtenhkbHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODI4NTAsImV4cCI6MjA4Njg1ODg1MH0.Vi8vI6ZGmKw4SpvW-3Ch0hCZOn4co71_4quE_oorDjQ";

async function sync() {
    console.log("--- SINCRONIZANDO SUPABASE CON STRIPE ---");

    const updates = [
        { slug: "demo", price: 0 },
        { slug: "starter", price: 500 },
        { slug: "growth", price: 900 },
        { slug: "scale", price: 1500 },
        { slug: "enterprise", price: 0 }
    ];

    for (const item of updates) {
        console.log(`Actualizando ${item.slug} a $${item.price / 100}...`);
        const res = await fetch(`${url}subscription_plans?slug=eq.${item.slug}`, {
            method: "PATCH",
            headers: {
                "apikey": key,
                "Authorization": "Bearer " + key,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ monthly_price_cents: item.price })
        });

        if (res.ok) {
            console.log(`✅ ${item.slug} actualizado.`);
        } else {
            const err = await res.json();
            console.error(`❌ Error en ${item.slug}:`, err);
        }
    }
    console.log("\n--- SINCRONIZACIÓN FINALIZADA ---");
}

sync();
