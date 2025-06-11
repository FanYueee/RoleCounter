/**
 * RoleCounter
 * 追蹤Discord伺服器中身分組的成員數量，並在語音頻道名稱中顯示
 */

const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');

/**
 * Discord客戶端實例
 * @type {Client}
 */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

/**
 * 機器人配置設定
 * @type {Object}
 * @property {string} token - Discord Bot Token
 * @property {string} clientId - Discord Application ID
 * @property {Object} trackedRoles - 追蹤的身分組資料 {guildId: {roleId: {channelId, nameTemplate}}}
 * @property {number} updateInterval - 更新間隔時間(毫秒)
 */
let config = {
    token: '',
    clientId: '',
    trackedRoles: {},
    updateInterval: 60000
};

if (fs.existsSync('./config.json')) {
    config = { ...config, ...JSON.parse(fs.readFileSync('./config.json', 'utf8')) };
} else {
    console.log('config.json 不存在，正在創建預設配置檔...');
    saveConfig();
    console.log('已創建 config.json，請填入你的 bot token 和 client ID 後重新啟動');
    process.exit(1);
}

/**
 * 儲存配置檔案到 config.json
 */
function saveConfig() {
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

/**
 * 計算指定身分組的成員數量
 * @param {Guild} guild - Discord伺服器物件
 * @param {string} roleId - 身分組ID
 * @returns {Promise<number>} 身分組成員數量
 */
async function countRoleMembers(guild, roleId) {
    const role = guild.roles.cache.get(roleId);
    if (!role) return 0;
    
    try {
        if (guild.members.cache.size === 0) {
            await guild.members.fetch();
        }
        return role.members.size;
    } catch (error) {
        console.error('Error fetching guild members:', error);
        return 0;
    }
}

/**
 * 根據模板生成語音頻道名稱
 * @param {Guild} guild - Discord伺服器物件
 * @param {string} roleId - 身分組ID
 * @param {Object} roleData - 身分組資料
 * @param {string} roleData.nameTemplate - 頻道名稱模板
 * @returns {Promise<string>} 生成的頻道名稱
 */
async function generateChannelName(guild, roleId, roleData) {
    const role = guild.roles.cache.get(roleId);
    if (!role) return 'Unknown Role';
    
    const memberCount = await countRoleMembers(guild, roleId);
    const template = roleData.nameTemplate || '{count} - {role}';
    
    return template
        .replace(/{count}/g, memberCount)
        .replace(/{role}/g, role.name)
        .replace(/{roleid}/g, roleId)
        .replace(/{guild}/g, guild.name);
}

/**
 * 更新語音頻道名稱
 * @param {Guild} guild - Discord伺服器物件
 * @param {string} roleId - 身分組ID
 * @param {Object} roleData - 身分組資料
 * @param {string} roleData.channelId - 語音頻道ID
 * @param {string} roleData.nameTemplate - 頻道名稱模板
 */
async function updateVoiceChannel(guild, roleId, roleData) {
    try {
        const channel = guild.channels.cache.get(roleData.channelId);
        if (!channel || channel.type !== ChannelType.GuildVoice) return;
        
        const newName = await generateChannelName(guild, roleId, roleData);
        
        if (channel.name !== newName) {
            await channel.setName(newName);
            console.log(`Updated channel: ${newName}`);
        }
    } catch (error) {
        console.error('Error updating voice channel:', error);
    }
}

/**
 * 創建新的語音頻道用於顯示身分組人數
 * @param {Guild} guild - Discord伺服器物件
 * @param {string} roleId - 身分組ID
 * @param {string} nameTemplate - 頻道名稱模板，預設為 '{count} - {role}'
 * @returns {Promise<VoiceChannel|null>} 創建的語音頻道或null
 */
async function createVoiceChannel(guild, roleId, nameTemplate = '{count} - {role}') {
    try {
        const roleData = { nameTemplate };
        const channelName = await generateChannelName(guild, roleId, roleData);
        
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: [PermissionFlagsBits.Connect]
                }
            ]
        });
        
        return channel;
    } catch (error) {
        console.error('Error creating voice channel:', error);
        return null;
    }
}

/**
 * 更新所有追蹤的語音頻道名稱
 * 遍歷所有伺服器的所有追蹤身分組，更新對應的語音頻道名稱
 */
async function updateAllChannels() {
    for (const guild of client.guilds.cache.values()) {
        const guildConfig = config.trackedRoles[guild.id];
        if (!guildConfig) continue;
        
        for (const [roleId, roleData] of Object.entries(guildConfig)) {
            const normalizedData = typeof roleData === 'string' 
                ? { channelId: roleData, nameTemplate: '{count} - {role}' }
                : roleData;
            await updateVoiceChannel(guild, roleId, normalizedData);
        }
    }
}

/**
 * Slash Commands 定義
 * @type {SlashCommandBuilder[]}
 */
const commands = [
    new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('添加要追蹤的身分組')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('要追蹤的身分組')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('template')
                .setDescription('頻道名稱模板 (可用參數: {count}, {role}, {roleid}, {guild})')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('移除追蹤的身分組')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('要移除的身分組')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('settemplate')
        .setDescription('設定身分組的頻道名稱模板')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('要設定的身分組')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('template')
                .setDescription('頻道名稱模板 (可用參數: {count}, {role}, {roleid}, {guild})')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('listroles')
        .setDescription('列出所有追蹤的身分組'),
    
    new SlashCommandBuilder()
        .setName('setinterval')
        .setDescription('設定更新間隔時間（秒）')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('更新間隔秒數')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(3600)),
    
    new SlashCommandBuilder()
        .setName('updateall')
        .setDescription('立即更新所有追蹤的頻道')
];

/**
 * 機器人準備就緒事件處理器
 * 當機器人成功連接到Discord時觸發
 */
client.once('ready', async () => {
    console.log(`Bot已登入: ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    try {
        console.log('註冊slash commands...');
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands }
        );
        console.log('Slash commands註冊成功');
    } catch (error) {
        console.error('註冊slash commands失敗:', error);
    }
    
    console.log('正在獲取所有伺服器成員...');
    for (const guild of client.guilds.cache.values()) {
        try {
            await guild.members.fetch();
            console.log(`已獲取 ${guild.name} 的成員列表`);
        } catch (error) {
            console.error(`獲取 ${guild.name} 成員列表失敗:`, error);
        }
    }
    console.log('成員列表獲取完成');
    
    setInterval(updateAllChannels, config.updateInterval);
    updateAllChannels();
});

/**
 * 處理Slash Command互動事件
 * @param {Interaction} interaction - Discord互動物件
 */
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: '你需要管理頻道的權限才能使用此指令', ephemeral: true });
        return;
    }
    
    const { commandName, guildId } = interaction;
    
    if (!config.trackedRoles[guildId]) {
        config.trackedRoles[guildId] = {};
    }
    
    switch (commandName) {
        case 'addrole':
            const roleToAdd = interaction.options.getRole('role');
            const template = interaction.options.getString('template') || '{count} - {role}';
            
            if (config.trackedRoles[guildId][roleToAdd.id]) {
                await interaction.reply({ content: `身分組 ${roleToAdd.name} 已經在追蹤清單中`, ephemeral: true });
                return;
            }
            
            const newChannel = await createVoiceChannel(interaction.guild, roleToAdd.id, template);
            if (newChannel) {
                config.trackedRoles[guildId][roleToAdd.id] = {
                    channelId: newChannel.id,
                    nameTemplate: template
                };
                saveConfig();
                await interaction.reply(`已添加身分組 ${roleToAdd.name} 到追蹤清單，頻道: ${newChannel.name}`);
            } else {
                await interaction.reply({ content: '創建語音頻道失敗', ephemeral: true });
            }
            break;
            
        case 'removerole':
            const roleToRemove = interaction.options.getRole('role');
            
            if (!config.trackedRoles[guildId][roleToRemove.id]) {
                await interaction.reply({ content: `身分組 ${roleToRemove.name} 不在追蹤清單中`, ephemeral: true });
                return;
            }
            
            const roleData = config.trackedRoles[guildId][roleToRemove.id];
            const channelId = typeof roleData === 'string' ? roleData : roleData.channelId;
            const channelToDelete = interaction.guild.channels.cache.get(channelId);
            if (channelToDelete) {
                await channelToDelete.delete();
            }
            
            delete config.trackedRoles[guildId][roleToRemove.id];
            saveConfig();
            await interaction.reply(`已移除身分組 ${roleToRemove.name} 從追蹤清單`);
            break;
            
        case 'settemplate':
            const roleToSet = interaction.options.getRole('role');
            const newTemplate = interaction.options.getString('template');
            
            if (!config.trackedRoles[guildId][roleToSet.id]) {
                await interaction.reply({ content: `身分組 ${roleToSet.name} 不在追蹤清單中`, ephemeral: true });
                return;
            }
            
            const existingData = config.trackedRoles[guildId][roleToSet.id];
            const existingChannelId = typeof existingData === 'string' ? existingData : existingData.channelId;
            
            config.trackedRoles[guildId][roleToSet.id] = {
                channelId: existingChannelId,
                nameTemplate: newTemplate
            };
            saveConfig();
            
            const updatedRoleData = config.trackedRoles[guildId][roleToSet.id];
            await updateVoiceChannel(interaction.guild, roleToSet.id, updatedRoleData);
            
            await interaction.reply(`已更新身分組 ${roleToSet.name} 的名稱模板為: ${newTemplate}`);
            break;
            
        case 'listroles':
            const trackedRoles = config.trackedRoles[guildId];
            if (!trackedRoles || Object.keys(trackedRoles).length === 0) {
                await interaction.reply('目前沒有追蹤任何身分組');
                return;
            }
            
            let roleList = '追蹤中的身分組:\n';
            for (const [roleId, roleData] of Object.entries(trackedRoles)) {
                const role = interaction.guild.roles.cache.get(roleId);
                const memberCount = await countRoleMembers(interaction.guild, roleId);
                const template = typeof roleData === 'string' ? '{count} - {role}' : roleData.nameTemplate;
                if (role) {
                    roleList += `• ${role.name}: ${memberCount} 人 (模板: ${template})\n`;
                }
            }
            await interaction.reply(roleList);
            break;
            
        case 'setinterval':
            const newInterval = interaction.options.getInteger('seconds') * 1000;
            config.updateInterval = newInterval;
            saveConfig();
            await interaction.reply(`更新間隔已設定為 ${newInterval / 1000} 秒`);
            break;
            
        case 'updateall':
            await updateAllChannels();
            await interaction.reply('已更新所有追蹤的頻道');
            break;
    }
});

/**
 * 成員加入伺服器事件處理器
 * @param {GuildMember} member - 加入的成員
 */
client.on('guildMemberAdd', async member => {
    setTimeout(updateAllChannels, 1000);
});

/**
 * 成員離開伺服器事件處理器
 * @param {GuildMember} member - 離開的成員
 */
client.on('guildMemberRemove', async member => {
    setTimeout(updateAllChannels, 1000);
});

/**
 * 成員資料更新事件處理器（主要監聽身分組變化）
 * @param {GuildMember} oldMember - 更新前的成員資料
 * @param {GuildMember} newMember - 更新後的成員資料
 */
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        setTimeout(updateAllChannels, 1000);
    }
});

/**
 * 機器人登入
 * 檢查是否有token，有則登入，無則提示用戶設定
 */
if (config.token) {
    client.login(config.token);
} else {
    console.log('請在config.json中設定你的bot token和client ID');
}