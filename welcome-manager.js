const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const WelcomeImage = require('./welcome');

class WelcomeManager {
    constructor(client) {
        this.client = client;
        this.welcomeImage = null;
        this.config = this.loadConfig();
        
        // Initialize welcome image handler
        if (this.config.enabled) {
            this.welcomeImage = new WelcomeImage(this.config);
        }
        
        console.log('🎉 歡迎管理器已初始化');
    }

    loadConfig() {
        const defaultConfig = {
            enabled: true,
            channelId: '',
            backgroundPath: './welcome_background1.png',
            avatarSize: 350,
            avatarPosition: { x: 480, y: 170 },
            avatarScaleMode: 'scale',
            avatarScaleFactor: 1.75,
            fillTransparent: true,
            transparentFillColor: '#000000'
        };

        try {
            if (fs.existsSync('./welcome-config.json')) {
                const savedConfig = JSON.parse(fs.readFileSync('./welcome-config.json', 'utf8'));
                return { ...defaultConfig, ...savedConfig };
            }
        } catch (error) {
            console.error('載入歡迎配置失敗:', error);
        }

        return defaultConfig;
    }

    saveConfig() {
        try {
            fs.writeFileSync('./welcome-config.json', JSON.stringify(this.config, null, 2));
            console.log('✅ 歡迎配置已保存');
        } catch (error) {
            console.error('保存歡迎配置失敗:', error);
        }
    }

    getCommands() {
        return [
            new SlashCommandBuilder()
                .setName('setwelcomechannel')
                .setDescription('設定歡迎圖片發送頻道')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('要發送歡迎圖片的頻道')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('testwelcome')
                .setDescription('測試歡迎圖片功能')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('測試用戶 (可選)')
                        .setRequired(false)),
            
            new SlashCommandBuilder()
                .setName('welcometoggle')
                .setDescription('啟用或停用歡迎功能')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('啟用歡迎功能')
                        .setRequired(true))
        ];
    }

    isWelcomeCommand(commandName) {
        const welcomeCommands = [
            'setwelcomechannel',
            'testwelcome',
            'welcometoggle'
        ];
        return welcomeCommands.includes(commandName);
    }

    async handleCommand(interaction) {
        // Check permissions for all commands
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '你需要管理頻道的權限才能使用此指令', ephemeral: true });
            return;
        }

        switch (interaction.commandName) {
            case 'setwelcomechannel':
                await this.handleSetWelcomeChannel(interaction);
                break;
            case 'testwelcome':
                await this.handleTestWelcome(interaction);
                break;
            case 'welcometoggle':
                await this.handleWelcomeToggle(interaction);
                break;
        }
    }

    async handleSetWelcomeChannel(interaction) {
        const channel = interaction.options.getChannel('channel');
        
        if (channel.type !== 0) { // 0 = GUILD_TEXT
            await interaction.reply({ content: '歡迎頻道必須是文字頻道', ephemeral: true });
            return;
        }
        
        this.config.channelId = channel.id;
        if (this.welcomeImage) {
            this.welcomeImage.setWelcomeChannel(channel.id);
        }
        this.saveConfig();
        await interaction.reply(`歡迎圖片發送頻道已設定為: ${channel.name}`);
    }

    async handleWelcomeConfig(interaction) {
        const channel = this.config.channelId ? 
            interaction.guild.channels.cache.get(this.config.channelId)?.name || '未找到頻道' : 
            '未設定';
        
        let configMessage = `**歡迎圖片配置:**\n`;
        configMessage += `狀態: ${this.config.enabled ? '✅ 啟用' : '❌ 停用'}\n`;
        configMessage += `頻道: ${channel}\n`;
        configMessage += `背景圖片: ${this.config.backgroundPath}\n`;
        configMessage += `頭像位置: (${this.config.avatarPosition.x}, ${this.config.avatarPosition.y})\n`;
        
        // 頭像大小顯示
        switch (this.config.avatarScaleMode) {
            case 'original':
                configMessage += `頭像大小: 原始大小\n`;
                break;
            case 'fixed':
                configMessage += `頭像大小: ${this.config.avatarSize}px (固定)\n`;
                break;
            case 'scale':
                configMessage += `頭像大小: ${this.config.avatarScaleFactor}x 縮放\n`;
                break;
        }
        
        configMessage += `透明填充: ${this.config.fillTransparent ? '✅ 啟用' : '❌ 停用'}`;
        if (this.config.fillTransparent) {
            configMessage += ` (${this.config.transparentFillColor})`;
        }
        configMessage += `\n`;
        
        await interaction.reply(configMessage);
    }

    async handleTestWelcome(interaction) {
        if (!this.config.enabled) {
            await interaction.reply({ content: '歡迎功能未啟用，請使用 `/welcometoggle enabled:True` 啟用', ephemeral: true });
            return;
        }
        
        if (!this.config.channelId) {
            await interaction.reply({ content: '尚未設定歡迎頻道，請使用 `/setwelcomechannel` 設定', ephemeral: true });
            return;
        }
        
        const testUser = interaction.options.getUser('user') || interaction.user;
        const testMember = interaction.guild.members.cache.get(testUser.id);
        
        if (!testMember) {
            await interaction.reply({ content: '找不到指定用戶', ephemeral: true });
            return;
        }
        
        await interaction.reply(`正在為 ${testMember.displayName} 生成測試歡迎圖片...`);
        
        try {
            if (this.welcomeImage) {
                await this.welcomeImage.handleMemberJoin(testMember, this.client);
                await interaction.followUp(`✅ 測試歡迎圖片已發送到 <#${this.config.channelId}>`);
            } else {
                await interaction.followUp('❌ 歡迎圖片處理器未初始化');
            }
        } catch (error) {
            console.error('測試歡迎圖片失敗:', error);
            await interaction.followUp('❌ 測試歡迎圖片生成失敗');
        }
    }

    async handleWelcomeToggle(interaction) {
        const enabled = interaction.options.getBoolean('enabled');
        this.config.enabled = enabled;
        
        if (enabled && !this.welcomeImage) {
            this.welcomeImage = new WelcomeImage(this.config);
        } else if (!enabled) {
            this.welcomeImage = null;
        }
        
        this.saveConfig();
        await interaction.reply(`歡迎功能已${enabled ? '啟用' : '停用'}`);
    }

    async handleSetAvatarPosition(interaction) {
        const x = interaction.options.getInteger('x');
        const y = interaction.options.getInteger('y');
        
        this.config.avatarPosition = { x, y };
        
        if (this.welcomeImage) {
            this.welcomeImage.avatarPosition = { x, y };
        }
        
        this.saveConfig();
        await interaction.reply(`頭像位置已設定為: (${x}, ${y})`);
    }

    async handleSetAvatarScale(interaction) {
        const mode = interaction.options.getString('mode');
        const factor = interaction.options.getNumber('factor');
        
        this.config.avatarScaleMode = mode;
        
        if (mode === 'scale' && factor) {
            this.config.avatarScaleFactor = factor;
        }
        
        if (this.welcomeImage) {
            this.welcomeImage.avatarScaleMode = mode;
            if (factor) {
                this.welcomeImage.avatarScaleFactor = factor;
            }
        }
        
        this.saveConfig();
        
        let message = `頭像縮放模式已設定為: ${mode}`;
        if (mode === 'scale' && factor) {
            message += ` (${factor}x)`;
        }
        
        await interaction.reply(message);
    }

    async handleSetAvatarSize(interaction) {
        const size = interaction.options.getInteger('size');
        
        this.config.avatarSize = size;
        // 設定為固定大小模式
        this.config.avatarScaleMode = 'fixed';
        
        if (this.welcomeImage) {
            this.welcomeImage.avatarSize = size;
            this.welcomeImage.avatarScaleMode = 'fixed';
        }
        
        this.saveConfig();
        await interaction.reply(`頭像大小已設定為: ${size}px (自動切換到固定大小模式)`);
    }

    async handleSetTransparentFill(interaction) {
        const enabled = interaction.options.getBoolean('enabled');
        const color = interaction.options.getString('color');
        
        this.config.fillTransparent = enabled;
        
        if (color) {
            // 驗證顏色格式
            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                await interaction.reply({ content: '顏色格式錯誤！請使用十六進位格式，例如: #000000', ephemeral: true });
                return;
            }
            this.config.transparentFillColor = color;
        }
        
        if (this.welcomeImage) {
            this.welcomeImage.fillTransparent = enabled;
            if (color) {
                this.welcomeImage.transparentFillColor = color;
            }
        }
        
        this.saveConfig();
        
        let message = `透明區域填充已${enabled ? '啟用' : '停用'}`;
        if (enabled && color) {
            message += ` (顏色: ${color})`;
        } else if (enabled) {
            message += ` (顏色: ${this.config.transparentFillColor})`;
        }
        
        await interaction.reply(message);
    }

    async handleMemberJoin(member) {
        if (!this.config.enabled || !this.config.channelId || !this.welcomeImage) {
            return;
        }
        
        try {
            await this.welcomeImage.handleMemberJoin(member, this.client);
        } catch (error) {
            console.error('❌ 歡迎圖片生成失敗:', error);
        }
    }
}

module.exports = WelcomeManager;