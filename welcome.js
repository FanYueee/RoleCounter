const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class WelcomeImage {
    constructor(options = {}) {
        this.backgroundPath = options.backgroundPath || './welcome_background1.png';
        this.welcomeChannelId = options.channelId || '';
        this.avatarSize = options.avatarSize || 350;
        this.avatarPosition = options.avatarPosition || { x: 480, y: 170 };
        this.avatarScaleMode = options.avatarScaleMode || 'scale';
        this.avatarScaleFactor = options.avatarScaleFactor || 1.75;
        this.fillTransparent = options.fillTransparent !== undefined ? options.fillTransparent : true;
        this.transparentFillColor = options.transparentFillColor || '#000000';
    }

    async downloadImage(url) {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer'
            });
            return Buffer.from(response.data);
        } catch (error) {
            console.error('Error downloading image:', error);
            throw error;
        }
    }

    getAvatarSize(originalWidth, originalHeight) {
        switch (this.avatarScaleMode) {
            case 'original':
                return Math.min(originalWidth, originalHeight);
            case 'fixed':
                return this.avatarSize;
            case 'scale':
                return Math.min(originalWidth, originalHeight) * this.avatarScaleFactor;
            default:
                return this.avatarSize;
        }
    }

    async cropToCircle(image, targetSize) {
        const canvas = createCanvas(targetSize, targetSize);
        const ctx = canvas.getContext('2d');
        
        // Create circular clipping path
        ctx.beginPath();
        ctx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        if (this.fillTransparent) {
            // Step 1: Create a temporary canvas for the image with background fill
            const tempCanvas = createCanvas(targetSize, targetSize);
            const tempCtx = tempCanvas.getContext('2d');
            
            // Fill temp canvas with specified background color
            tempCtx.fillStyle = this.transparentFillColor;
            tempCtx.fillRect(0, 0, targetSize, targetSize);
            
            // Draw the image on top of background
            // This will fill any transparent areas with the specified color
            tempCtx.drawImage(image, 0, 0, targetSize, targetSize);
            
            // Draw the processed image within the circular clip
            ctx.drawImage(tempCanvas, 0, 0);
            
            console.log(`🔵 頭像已處理：透明區域已填充 ${this.transparentFillColor} 背景`);
        } else {
            // Draw image directly without background fill
            ctx.drawImage(image, 0, 0, targetSize, targetSize);
            console.log('🔵 頭像已處理：保持原始透明度');
        }
        
        return canvas;
    }


    async generateWelcomeImage(member) {
        try {
            console.log(`🎨 正在為 ${member.displayName} 生成歡迎圖片...`);
            
            // Download user avatar
            const avatarUrl = member.displayAvatarURL({ extension: 'png', size: 512 });
            const avatarBuffer = await this.downloadImage(avatarUrl);
            const avatarImage = await loadImage(avatarBuffer);

            // Load background image
            let background;
            try {
                background = await loadImage(this.backgroundPath);
                console.log(`✅ 載入背景圖片: ${this.backgroundPath}`);
            } catch (error) {
                console.warn('⚠️ 背景圖片未找到，使用預設背景');
                background = this.createDefaultBackground();
            }

            // Create main canvas with background dimensions
            const canvas = createCanvas(background.width, background.height);
            const ctx = canvas.getContext('2d');

            // Draw background
            ctx.drawImage(background, 0, 0);

            // Calculate actual avatar size and create circular avatar
            const actualAvatarSize = this.getAvatarSize(avatarImage.width, avatarImage.height);
            const circularAvatar = await this.cropToCircle(avatarImage, actualAvatarSize);

            // Calculate avatar position (center point coordinates)
            const avatarLeft = this.avatarPosition.x - actualAvatarSize / 2;
            const avatarTop = this.avatarPosition.y - actualAvatarSize / 2;
            ctx.drawImage(circularAvatar, avatarLeft, avatarTop);

            console.log(`🖼️ 頭像大小: ${actualAvatarSize}px，位置: (${this.avatarPosition.x}, ${this.avatarPosition.y})`);

            // Save image
            const fileName = `${member.id}_welcome.png`;
            const filePath = path.join(__dirname, fileName);
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(filePath, buffer);

            console.log(`💾 圖片已生成: ${fileName}`);

            return {
                filePath: filePath,
                fileName: fileName
            };

        } catch (error) {
            console.error('❌ 生成歡迎圖片失敗:', error);
            throw error;
        }
    }

    createDefaultBackground() {
        // Create a default background if no background image is provided
        const canvas = createCanvas(1200, 1500);
        const ctx = canvas.getContext('2d');
        
        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        return canvas;
    }

    async handleMemberJoin(member, client) {
        try {
            console.log(`🎉 正在為 ${member.displayName} 生成歡迎圖片...`);
            const result = await this.generateWelcomeImage(member);
            
            // Get welcome channel
            const welcomeChannel = client.channels.cache.get(this.welcomeChannelId);
            if (!welcomeChannel) {
                console.error('❌ 歡迎頻道未找到:', this.welcomeChannelId);
                return;
            }

            // Send welcome image
            const { AttachmentBuilder } = require('discord.js');
            const attachment = new AttachmentBuilder(result.filePath);
            
            await welcomeChannel.send({
                content: `🎉 歡迎 ${member.displayName} 加入伺服器！`,
                files: [attachment]
            });

            console.log(`✅ 歡迎圖片已發送到 ${welcomeChannel.name}`);

            // Clean up temporary file
            setTimeout(() => {
                try {
                    fs.unlinkSync(result.filePath);
                    console.log(`🗑️ 清理臨時檔案: ${result.fileName}`);
                } catch (error) {
                    console.error('Error deleting temporary file:', error);
                }
            }, 5000);

        } catch (error) {
            console.error('❌ 處理成員加入失敗:', error);
        }
    }

    setWelcomeChannel(channelId) {
        this.welcomeChannelId = channelId;
    }

    setBackgroundPath(backgroundPath) {
        this.backgroundPath = backgroundPath;
    }
}

module.exports = WelcomeImage;