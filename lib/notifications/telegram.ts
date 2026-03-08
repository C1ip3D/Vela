export async function sendTelegram(
    botToken: string,
    chatId: string,
    text: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "HTML",
            }),
        });
        const data = await res.json();
        if (!data.ok) {
            return { success: false, error: data.description };
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
