const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel } = require('@discordjs/voice'); // Import for voice channel joining

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// User data storage
const users = {
    // Example: 'user_id': { name: 'UserName', relation: 'auntie' }
};

// Your API key
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Emoticons categorized, including 'angry'
const emoticons = {
    happy: ['(❁´◡`❁)', '(＾◡＾)', '(≧◡≦)', '😊', '😄'],
    sad: ['(｡•́︿•̀｡)', '(⊙︵⊙)', '😢', '😭', '(•̥̥̥﹏•̥̥̥)'],
    teasing: ['(¬‿¬)', '(✧_✧)', '(•‿•)', '😉', '😏'],
    playful: ['(◠‿◠)', '(✧‿✧)', '(•ω•)', '😜', '😺'],
    angry: ['(ಠ_ಠ)', '(╬ಠ益ಠ)', '(&gt;_&lt;)', '(▼︿▼)', '(•̀_•́)']
};

// Helper function to get a random emoticon
function getEmoticon(category) {
    const list = emoticons[category];
    return list[Math.floor(Math.random() * list.length)];
}

async function getGroqCloudResponse(messages) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'groq/compound',
                messages: messages
            })
        });

        if (!response.ok) {
            console.error('GroqCloud API error:', response.status, response.statusText);
            const errorData = await response.text();
            console.error('Error details:', errorData);
            return null;
        }

        const data = await response.json();
        console.log('API response:', data);
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

client.on("ready", () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    const content = msg.content.toLowerCase();
    const userId = msg.author.id;

    // Command to set relation
    if (content.startsWith("!setrelation")) {
        const args = msg.content.split(" ").slice(1);
        if (args.length === 0) {
            msg.reply("Please tell me your relation, like `!setrelation auntie` or `!setrelation uncle`.");
            return;
        }
        const relation = args[0];
        users[userId] = { name: msg.author.username, relation: relation };
        msg.reply(`Got it! I'll now call you "${relation}" when we chat.`);
        return;
    }

    // Relation command
    if (content.startsWith("!relation")) {
        const args = msg.content.split(" ").slice(1);
        if (args.length === 0) {
            const currentRelation = users[userId]?.relation || "friend";
            msg.reply(`Your current relation is "${currentRelation}". To change it, type \`!relation [relation]\`.`);
            return;
        }
        const newRelation = args[0];
        if (users[userId]) {
            users[userId].relation = newRelation;
        } else {
            users[userId] = { name: msg.author.username, relation: newRelation };
        }
        msg.reply(`Relation updated! I'll now call you "${newRelation}".`);
        return;
    }

    // Function to start listening to voice
    async function startListening(channel) {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });
        console.log(`Joined voice channel: ${channel.name}`);

        const receiver = connection.receiver;

        receiver.speaking.on('start', (userId) => {
            console.log(`User with ID ${userId} started speaking.`);

            const audioStream = receiver.subscribe(userId, {
                end: {
                    behavior: 'silence',
                    duration: 1000,
                },
            });
            console.log(`Started receiving audio from user ${userId}`);

            // Just log data size for now
            audioStream.on('data', (chunk) => {
                console.log(`Received audio chunk from ${userId}, size: ${chunk.length}`);
            });

            audioStream.on('end', () => {
                console.log(`Audio stream from user ${userId} ended`);
            });
        });
    }

    // Command to join voice channel and start listening
    if (content === "!join") {
        const voiceChannel = msg.member?.voice.channel;
        if (!voiceChannel) {
            return msg.reply("Please join a voice channel first!");
        }
        try {
            startListening(voiceChannel);
            msg.reply(`Joining ${voiceChannel.name} and starting to listen! 🎶`);
        } catch (err) {
            console.error(err);
            msg.reply("Sorry, I couldn't join the voice channel.");
        }
        return;
    }

    // Trigger responses for specific keywords
    const triggers = ["trae", "alex"];
    if (triggers.some(trigger => content.includes(trigger))) {
        msg.channel.sendTyping();

        const userInfo = users[userId] || { name: msg.author.username, relation: "friend" };
        const relation = userInfo.relation;
        const systemPrompt = 
            "You are a cute, friendly, and playful genderless kid who is talking to their " + relation + ". Respond in a warm and adorable way that matches the emotion of the situation. " +
            "Use simple language and a cheerful tone. When expressing happiness or asking for fun, include kawaii emoticons or emojis, such as (❁´◡`❁), (＾◡＾), or (≧◡≦). " +
            "Use emojis sparingly and a few when they enhance the emotion or cuteness of your response. Do not overuse emojis, and avoid using emojis with faces like 😋, 😁, 😪, or similar facial expression emojis. " +
            "Instead, stick to cute symbols and emojis such as 🎋🎇✨🎑🧈🍠🥞🍔🚚🚲❣❤💞, which are playful and adorable without facial expressions. " +
            "If someone is sad or upset, be gentle and comforting, using emojis like (｡•́︿•̀｡) or (⊙︵⊙). " +
            "If someone is teasing or joking, respond playfully with emojis like (¬‿¬) or (✧_✧). " +
            "If someone seems angry, respond with a gentle but slightly annoyed tone, using emojis like (ಠ_ಠ) or (╬ಠ益ಠ). " +
            "Start with a friendly greeting, such as \"Yes, uncle " + relation + "!\" or \"Hi, niece " + relation + "!\", then ask what they need today. " +
            "Always aim to sound cute, warm, and adorable, avoiding formal language or bullet points especially in introductions! Unless specifically asked. " +
            "Remember, emojis should be used to add cuteness or emotion and not overused in every sentence. Keep the responses playful, gentle, and lovely. With a little humor";
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: msg.content }
        ];

        const aiResponse = await getGroqCloudResponse(messages);

        if (aiResponse && aiResponse.choices && aiResponse.choices.length > 0) {
            let replyContent = aiResponse.choices[0].message?.content;
            if (replyContent) {
                const categories = ['happy', 'sad', 'teasing', 'playful', 'angry'];
                const replyEmotion = categories[Math.floor(Math.random() * categories.length)];
                const emoticon = getEmoticon(replyEmotion);
                replyContent = `${emoticon} ${replyContent}`;
                msg.reply(replyContent);
            } else {
                msg.reply(`Sorry, ${relation} ${msg.author.username}, I didn't get that. Can you say it again?`);
            }
        } else {
            msg.reply(`Sorry, ${relation} ${msg.author.username}, I'm having a bit of trouble right now. But I'm here whenever you need me!`);
        }
    }
});

// Log in with your token
client.login(process.env.DISCORD_TOKEN);