$(function() {
    
    // ----------------------------------------------------------------
    // 1. 全局常量、变量和颜色工具函数
    // ----------------------------------------------------------------
    const $clocksContainer = $('#clocks-container');
    const STORAGE_KEY = 'myCountdownClocks_v3'; 
    const WALLPAPER_KEY = 'currentWallpaper';
    const WALLPAPER_TYPE_KEY = 'wallpaperType'; 
    const GLOBAL_SETTINGS_KEY = 'globalSettings';
    
    // 默认设置中添加 newClockDefaultTime
    let globalSettings = {
        fabColorMode: 'default',
        timeNumberColor: '#FFFFFF',
        progressBarColor: '#4CAF50',
        settingsFabColor: generateRandomColor(),
        newClockDefaultTime: '7d' // 默认间隔 7 天
    };
	// *** 新增：Gemini API Key 相关常量和变量 ***
    const API_KEY_STORAGE_KEY = 'geminiApiKey';
    let apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    
    // *** 新增：API Key 相关的 DOM 元素 ***
    const $apiKeyInput = $('#apiKeyInput');
    const $saveApiKeyBtn = $('#saveApiKeyBtn');
    
    // ... (其他 timer.js 变量) ...

    function hexToRgb(hex) {
        // 专门处理 RGB 到 HEX 的转换，用于标题颜色
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        });
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [255, 255, 255];
    }
    
    function calculateLuminance(hex) {
        const rgb = hexToRgb(hex);
        const r = rgb[0] / 255;
        const g = rgb[1] / 255;
        const b = rgb[2] / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function generateRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
    
    // 辅助函数：生成稍浅的颜色用于进度条渐变
    function generateLighterColor(hex) {
        let [r, g, b] = hexToRgb(hex);
        r = Math.min(255, r + 50);
        g = Math.min(255, g + 50);
        b = Math.min(255, b + 50);
        const toHex = (c) => c.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }


    // ----------------------------------------------------------------
    // 2. 数据存储与加载
    // ----------------------------------------------------------------

    function saveClocksToStorage() {
        const clocksData = [];
        $('.clock-instance').each(function() {
            const $this = $(this);
            const isSettingsVisible = $this.find('.clock-settings').is(':visible');
            
            clocksData.push({
                id: $this.attr('id'),
                targetTime: $this.data('target-time'),
                // *** 修复：存储起始时间 ***
                startTime: $this.data('start-time'), 
                title: $this.find('.clock-title').text(),
                // 存储 RGB 字符串，在 renderClock 中转换为 HEX
                titleColor: $this.find('.clock-title').css('color'),
                isMinimized: $this.data('is-minimized') || false,
                isSettingsVisible: isSettingsVisible
            });
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clocksData));
    }

    function loadClocksFromStorage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    }
    
    function loadGlobalSettings() {
        const savedSettings = localStorage.getItem(GLOBAL_SETTINGS_KEY);
        if (savedSettings) {
            Object.assign(globalSettings, JSON.parse(savedSettings));
        }
        // 同步 UI 状态
        $('#fab-color-mode').val(globalSettings.fabColorMode);
        $('#time-number-color').val(globalSettings.timeNumberColor);
        $('#time-number-color-text').val(globalSettings.timeNumberColor);
        $('#progress-bar-color').val(globalSettings.progressBarColor);
        $('#progress-bar-color-text').val(globalSettings.progressBarColor);
        $('#new-clock-default-time').val(globalSettings.newClockDefaultTime); 
    }

    function saveGlobalSettings() {
        localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(globalSettings));
    }
    
    function applyGlobalSettings() {
        // 应用全局时间数字颜色
        $('.time-l').css('color', globalSettings.timeNumberColor);
        // 更新 FAB 颜色
        updateMinimizedFabColors();
        
        // 确保进度条颜色也能应用到新创建的
        $('.progress-bar-inner').css('background', `linear-gradient(90deg, ${globalSettings.progressBarColor}, ${generateLighterColor(globalSettings.progressBarColor)})`);
    }


    // ----------------------------------------------------------------
    // 3. 时钟创建与更新 
    // ----------------------------------------------------------------

    // 辅助函数：根据间隔字符串计算目标时间
    function calculateTargetTime(interval) {
        const now = new Date();
        const value = parseInt(interval.slice(0, -1));
        const unit = interval.slice(-1);
        
        const targetTime = new Date(now.getTime());

        switch (unit) {
            case 'm': // 分钟
                targetTime.setMinutes(now.getMinutes() + value);
                break;
            case 'h': // 小时
                targetTime.setHours(now.getHours() + value);
                break;
            case 'd': // 天
                targetTime.setDate(now.getDate() + value);
                break;
            default:
                targetTime.setDate(now.getDate() + 7);
                break;
        }
        
        const yyyy = targetTime.getFullYear();
        const mm = String(targetTime.getMonth() + 1).padStart(2, '0');
        const dd = String(targetTime.getDate()).padStart(2, '0');
        const hh = String(targetTime.getHours()).padStart(2, '0');
        const min = String(targetTime.getMinutes()).padStart(2, '0');
        
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }
    
    // 辅助函数：格式化 Date 对象为 YYYY-MM-DDTHH:MM 格式的字符串
    function formatDateToInput(date) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    function generateClockHtml(id, targetTime, startTime, title, titleColor, isSettingsVisible, isMinimized) {
        
        const cardClass = isMinimized ? 'clock-instance minimized' : 'clock-instance';

        return `
            <div class="${cardClass}" id="${id}" data-target-time="${targetTime}" data-start-time="${startTime}" data-is-minimized="${isMinimized}">
                <div class="clock-header">
                    <span class="clock-title" contenteditable="true" style="color: ${titleColor};">${title}</span>
                    <div class="clock-controls">
                        <button class="settings-toggle-btn" title="设置">▼</button>
                        <button class="minimize-toggle-btn" title="${isMinimized ? '展开' : '最小化'}">━</button>
                        <button class="delete-clock-btn" title="删除">✖</button>
                    </div>
                </div>
                
                <div class="clock-body" ${isMinimized ? 'style="display: none;"' : ''}>
                    <div class="clock-settings" ${isSettingsVisible ? '' : 'style="display: none;"'}>
                        <label>倒计时目标时间:</label>
                        <input type="datetime-local" class="target-time-input" value="${targetTime}">
                        
                        <label>倒计时起始时间:</label>
                        <input type="datetime-local" class="start-time-input" value="${startTime}">
                        
                        <div class="title-color-group">
                            <label>标题颜色:</label>
                            <div class="color-controls">
                                <input type="color" class="title-color-picker" value="${titleColor}">
                                <button class="reset-title-color-btn">重置</button>
                            </div>
                        </div>
                    </div>

                    <div class="time-box">
                        <ul>
                            <li><span class="time-l days">00</span><span class="time-s">天</span></li>
                            <li><span class="time-l hours">00</span><span class="time-s">时</span></li>
                            <li><span class="time-l minutes">00</span><span class="time-s">分</span></li>
                            <li><span class="time-l seconds">00</span><span class="time-s">秒</span></li>
                        </ul>
                    </div>
                    
                    <div class="progress-bar-container">
                        <div class="progress-bar-inner"></div>
                        <span class="progress-percent-text">0.00%</span>
                    </div>

                    <div class="date-tips">
                        <span class="start-date-tip">起始: ${new Date(startTime).toLocaleDateString()}</span>
                        <span class="end-date-tip">目标: ${new Date(targetTime).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function addNewClock() {
        const newId = 'clock-' + Date.now();
        
        // *** 修复：设置起始时间为创建时的时间 ***
        const startTime = formatDateToInput(new Date()); 
        const targetTime = calculateTargetTime(globalSettings.newClockDefaultTime);
        
        const defaultTitleColor = '#FFFFFF';
        
        const newClockHtml = generateClockHtml(newId, targetTime, startTime, '新的倒计时', defaultTitleColor, true, false);
        $clocksContainer.append(newClockHtml);
        
        const $newClock = $('#' + newId);
        
// timer.js (在 addNewClock 函数内)

        $newClock.draggable({
            handle: ".clock-header",
            containment: "window", 
            // *** 添加此行：忽略发生在 .clock-title 上的点击事件 ***
            cancel: ".clock-title" 
        });
        
        $newClock.find('.time-l').css('color', globalSettings.timeNumberColor);
        $newClock.find('.progress-bar-inner').css('background', `linear-gradient(90deg, ${globalSettings.progressBarColor}, ${generateLighterColor(globalSettings.progressBarColor)})`);


        saveClocksToStorage();
        updateClockDisplay($newClock);
    }
    
    function renderClock(data) {
        // 确保颜色是 #HEX 格式，即使存储的是 RGB 字符串
        let color = data.titleColor;
        const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (rgbMatch) {
            const toHex = (c) => parseInt(c).toString(16).padStart(2, '0');
            color = `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
        }
        
        // *** 修复：确保 startTime 存在，如果不存在则使用默认值 ***
        const startTime = data.startTime || formatDateToInput(new Date(Date.now() - 1000 * 60 * 60)); // 默认一小时前
        
        const html = generateClockHtml(data.id, data.targetTime, startTime, data.title, color, data.isSettingsVisible, data.isMinimized);
        $clocksContainer.append(html);
        const $clock = $('#' + data.id);
        
// timer.js (在 renderClock 函数内)

        $clock.draggable({
            handle: ".clock-header",
            containment: "window",
            // *** 添加此行：忽略发生在 .clock-title 上的点击事件 ***
            cancel: ".clock-title"
        });

        $clock.find('.time-l').css('color', globalSettings.timeNumberColor);
        $clock.find('.progress-bar-inner').css('background', `linear-gradient(90deg, ${globalSettings.progressBarColor}, ${generateLighterColor(globalSettings.progressBarColor)})`);


        if (data.isMinimized) {
            createMinimizedFabButton($clock);
        }
        
        updateClockDisplay($clock);
    }

    function updateClockDisplay($clock) {
        const targetDate = new Date($clock.data('target-time'));
        // *** 修复：获取起始时间 ***
        const startDate = new Date($clock.data('start-time'));
        const now = new Date();
        const diff = targetDate.getTime() - now.getTime();
        
        // 总时长 (毫秒)
        const totalDuration = targetDate.getTime() - startDate.getTime(); 

        const $days = $clock.find('.days');
        const $hours = $clock.find('.hours');
        const $minutes = $clock.find('.minutes');
        const $seconds = $clock.find('.seconds');
        const $progressInner = $clock.find('.progress-bar-inner');
        const $percentText = $clock.find('.progress-percent-text');
        const $fab = $(`#fab-${$clock.attr('id')}`);

        $clock.removeClass('completed');
        
        let percent = '0.00%';
        
        if (diff <= 0) {
            // 倒计时结束
            $days.text('00');
            $hours.text('00');
            $minutes.text('00');
            $seconds.text('00');
            $progressInner.css('width', '100%');
            percent = '100.00%';
            $percentText.text(percent);
            $clock.addClass('completed');

            // 更新最小化按钮状态：显示“完成”和 100%
            if ($fab.length) {
                $fab.addClass('completed');
                $fab.find('.fab-title').text($clock.find('.clock-title').text());
                $fab.find('.fab-percent').text(percent);
            }

        } else {
            // 倒计时进行中
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            $days.text(days < 10 ? '0' + days : days);
            $hours.text(hours < 10 ? '0' + hours : hours);
            $minutes.text(minutes < 10 ? '0' + minutes : minutes);
            $seconds.text(seconds < 10 ? '0' + seconds : seconds);
            
            // *** 修复：进度条计算 - 使用起始时间作为基点 ***
            let progress = 0;
            if (totalDuration > 0) {
                 const elapsedDuration = now.getTime() - startDate.getTime();
                 progress = Math.min(1, Math.max(0, elapsedDuration / totalDuration));
            }

            percent = (progress * 100).toFixed(2) + '%';
            $progressInner.css('width', percent);
            $percentText.text(percent);

            // 最小化悬浮球更新
            if ($fab.length) {
                const title = $clock.find('.clock-title').text();
                $fab.find('.fab-title').text(title);
                $fab.find('.fab-percent').text(percent);
                $fab.removeClass('completed');
            }
        }
    }
    
    // 主循环：每秒更新所有时钟
    setInterval(() => {
        $('.clock-instance').each(function() {
            updateClockDisplay($(this));
        });
    }, 1000);
    
// ... (最小化 FAB 按钮逻辑) ...
    function createMinimizedFabButton($clock) {
        const clockId = $clock.attr('id');
        const title = $clock.find('.clock-title').text();
        
        if ($(`#fab-${clockId}`).length) return;
        
        const initialPercent = $clock.find('.progress-percent-text').text() || '0.00%';
        
        // 悬浮球 HTML 结构修改：包含标题和百分比
        const $fab = $(`<button id="fab-${clockId}" class="fab-button minimized-clock-btn bounce animated" title="${title}">
                            <span class="fab-title">${title}</span>
                            <span class="fab-percent">${initialPercent}</span>
                        </button>`);
        
        // *** 修复核心：使用 append()。在 flex-direction: row-reverse 布局下，
        // append() 会使新元素在 DOM 列表的末尾，但在视觉上出现在最左侧。 ***
        $('#fab-container').append($fab); 
        
        updateFabColor($fab, $clock);

        $fab.on('click', function() {
            toggleClockMinimize($clock);
        });
    }

    function removeMinimizedFabButton(clockId) {
        $(`#fab-${clockId}`).remove();
    }
    
    function updateFabColor($fab, $clock) {
        let color;
        switch (globalSettings.fabColorMode) {
            case 'random':
                color = $clock.data('fab-color') || generateRandomColor();
                $clock.data('fab-color', color);
                break;
            case 'title':
                // 确保获取的是 #HEX 格式
                const titleColorRgb = $clock.find('.clock-title').css('color');
                const match = titleColorRgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                if (match) {
                    const toHex = (c) => parseInt(c).toString(16).padStart(2, '0');
                    color = `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
                } else {
                    color = '#FFFFFF'; 
                }
                break;
            case 'default':
            default:
                // 修复默认主题色为半透明黑
                color = 'rgba(0, 0, 0, 0.75)'; 
                return $fab.css('background-color', color);
        }
        $fab.css('background-color', color);
    }
    
    function updateMinimizedFabColors() {
        // 筛选出被最小化的时钟
        $('.clock-instance[data-is-minimized="true"]').each(function() {
            updateFabColor($(`#fab-${$(this).attr('id')}`), $(this));
        });
    }

    // 最小化/展开功能逻辑
    function toggleClockMinimize($clock) {
        const isMinimized = $clock.data('is-minimized');
        const clockId = $clock.attr('id');
        const $minimizeBtn = $clock.find('.minimize-toggle-btn');
        const $clockBody = $clock.find('.clock-body'); 

        if (isMinimized) {
            // 展开
            $clock.data('is-minimized', false).removeClass('minimized'); 
            $clockBody.slideDown(300);
            removeMinimizedFabButton(clockId);
            $minimizeBtn.attr('title', '最小化');
        } else {
            // 最小化
            $clock.data('is-minimized', true);
            $clockBody.slideUp(300, function() {
                 $clock.addClass('minimized'); 
            }); 
            createMinimizedFabButton($clock);
            $minimizeBtn.attr('title', '展开');
        }
        saveClocksToStorage();
    }

    function deleteClock($clock) {
        const clockId = $clock.attr('id');
        $clock.remove();
        removeMinimizedFabButton(clockId);
        saveClocksToStorage();
    }
    
    // ----------------------------------------------------------------
    // 4. 壁纸逻辑
    // ----------------------------------------------------------------

    const WALLPAPERS = [
        "https://wallpaper.infinitynewtab.com/wallpaper/4009.jpg",
        "https://wallpaper.infinitynewtab.com/wallpaper/4005.jpg",
        "https://wallpaper.infinitynewtab.com/wallpaper/4001.jpg",
        "https://wallpaper.infinitynewtab.com/wallpaper/4003.jpg"
    ];

    function setRandomBackground() {
        const randomIndex = Math.floor(Math.random() * WALLPAPERS.length);
        const url = WALLPAPERS[randomIndex];
        $('body').css('background-image', `url('${url}')`);
        localStorage.setItem(WALLPAPER_KEY, url);
        localStorage.setItem(WALLPAPER_TYPE_KEY, 'random');
    }

    function setLocalBackground(dataUrl) {
        $('body').css('background-image', `url('${dataUrl}')`);
        localStorage.setItem('savedLocalWallpaper', dataUrl); 
        localStorage.setItem(WALLPAPER_TYPE_KEY, 'local');
    }
    
    function loadWallpaper() {
        const type = localStorage.getItem(WALLPAPER_TYPE_KEY) || 'random';
        const localUrl = localStorage.getItem('savedLocalWallpaper');
        const lastUrl = localStorage.getItem(WALLPAPER_KEY);

        if (type === 'local' && localUrl) {
            $('body').css('background-image', `url('${localUrl}')`);
        } else if (lastUrl) {
            $('body').css('background-image', `url('${lastUrl}')`);
            localStorage.setItem(WALLPAPER_TYPE_KEY, 'random');
        } else {
            setRandomBackground();
        }
    }

// ----------------------------------------------------------------
    // 5. 事件监听器
    // ----------------------------------------------------------------

    $('#add-clock-btn').on('click', addNewClock);
    
    // *** 移除 BINGO 模态框显示逻辑，交给 bingo.js 处理新设置面板 ***
    /*
    $('#bingo-fab').on('click', function() {
        $('#bingo-modal').fadeIn(300);
    });
    $('#bingo-modal').on('click', function(e) {
        if (e.target.id === 'bingo-modal' || $(e.target).hasClass('close-bingo-btn')) { 
            $(this).fadeOut(300);
        }
    });
    */

    $clocksContainer.on('click', '.delete-clock-btn', function() {
        const $clock = $(this).closest('.clock-instance');
        deleteClock($clock);
    });

    $clocksContainer.on('click', '.minimize-toggle-btn', function() {
        const $clock = $(this).closest('.clock-instance');
        toggleClockMinimize($clock);
    });

    $clocksContainer.on('click', '.settings-toggle-btn', function() {
        const $settings = $(this).closest('.clock-instance').find('.clock-settings');
        $settings.slideToggle(300, function() {
            saveClocksToStorage();
        });
    });
	$saveApiKeyBtn.on('click', function() {
        const key = $apiKeyInput.val().trim(); 

        if (key) {
            // 1. 保存到 localStorage
            localStorage.setItem(API_KEY_STORAGE_KEY, key);
            
            // 2. 更新全局变量
            // 注意：如果 bingo.js 需要使用这个 apiKey，它需要在自身文件内重新读取 localStorage
            apiKey = key; 
            
            // 3. 提示用户 (假设您有一个 showMessage 函数，如果没有请使用 alert)
            // 如果没有 showMessage，请使用 alert("Gemini API Key 已保存。");
            showMessage('Gemini API Key 已保存。', 'success'); 
        } else {
            // 4. 清除 Key
            localStorage.removeItem(API_KEY_STORAGE_KEY);
            apiKey = null; 
            showMessage('Gemini API Key 已清除。', 'info');
            // 如果没有 showMessage，请使用 alert("Gemini API Key 已清除。");
        }
    });
    $clocksContainer.on('click', '.reset-title-color-btn', function() {
        const $title = $(this).closest('.clock-instance').find('.clock-title');
        $title.css('color', '#FFFFFF');
        $(this).closest('.clock-settings').find('.title-color-picker').val('#ffffff');
        saveClocksToStorage();
        updateMinimizedFabColors();
    });

    // 目标时间修改
    $clocksContainer.on('change', '.target-time-input', function() {
        const $clock = $(this).closest('.clock-instance');
        $clock.data('target-time', $(this).val());
        // 更新目标日期提示
        $clock.find('.end-date-tip').text(`目标: ${new Date($(this).val()).toLocaleDateString()}`);
        updateClockDisplay($clock);
        saveClocksToStorage();
    });
    
    // *** 修复：起始时间修改事件 ***
    $clocksContainer.on('change', '.start-time-input', function() {
        const $clock = $(this).closest('.clock-instance');
        $clock.data('start-time', $(this).val());
        // 更新起始日期提示
        $clock.find('.start-date-tip').text(`起始: ${new Date($(this).val()).toLocaleDateString()}`);
        updateClockDisplay($clock);
        saveClocksToStorage();
    });


    $clocksContainer.on('input', '.clock-title', function() {
        const $clock = $(this).closest('.clock-instance');
        const title = $(this).text();
        const $fab = $(`#fab-${$clock.attr('id')}`);
        
        if ($fab.length) {
            $fab.attr('title', title);
            $fab.find('.fab-title').text(title);
        }

        saveClocksToStorage();
        updateMinimizedFabColors();
    });

    $clocksContainer.on('input', '.title-color-picker', function() {
        const color = $(this).val();
        $(this).closest('.clock-instance').find('.clock-title').css('color', color);
        saveClocksToStorage();
        updateMinimizedFabColors();
    });

    $('#settings-fab').on('click', function() {
        $('#global-settings-menu').slideToggle(300);
    });
    
    $('#new-clock-default-time').on('change', function() {
        globalSettings.newClockDefaultTime = $(this).val();
        saveGlobalSettings();
    });

    $('#fab-color-mode').on('change', function() {
        globalSettings.fabColorMode = $(this).val();
        saveGlobalSettings();
        updateMinimizedFabColors();
    });
    
    $('#time-number-color, #time-number-color-text').on('input', function() {
        const color = $(this).val();
        globalSettings.timeNumberColor = color;
        $('#time-number-color').val(color);
        $('#time-number-color-text').val(color);
        applyGlobalSettings();
        saveGlobalSettings();
    });
    
    $('#progress-bar-color, #progress-bar-color-text').on('input', function() {
        const color = $(this).val();
        globalSettings.progressBarColor = color;
        $('#progress-bar-color').val(color);
        $('#progress-bar-color-text').val(color);
        $('.progress-bar-inner').css('background', `linear-gradient(90deg, ${color}, ${generateLighterColor(color)})`);
        saveGlobalSettings();
    });


    // 壁纸相关事件
    $('#import-local-wallpaper-btn').on('click', function() {
        $('#local-wallpaper-input').trigger('click');
    });

    $('#local-wallpaper-input').off('change').on('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                setLocalBackground(e.target.result); 
                $('#local-wallpaper-input').val('');
            };
            reader.onerror = function() {
                console.error("FileReader failed to read file.");
                alert("导入图片失败，请检查文件格式。");
            };
            reader.readAsDataURL(file);
        }
    });

    //$('#set-random-wallpaper-btn').on('click', function() {
       // setRandomBackground();
      //  alert("已切换到随机壁纸。");
   // });功能重复了，傻逼ai
    
    $('#clear-local-wallpaper-btn').on('click', function() {
        localStorage.removeItem('savedLocalWallpaper');
        setRandomBackground();
    });

    
    // ----------------------------------------------------------------
    // 6. 初始化 
    // ----------------------------------------------------------------

    (function init() {
        loadWallpaper(); 
        loadGlobalSettings();
        
        const initialClocks = loadClocksFromStorage();
        
        if (initialClocks.length > 0) {
            initialClocks.forEach(clockData => {
                renderClock(clockData);
            });
        } else {
            addNewClock(); 
        }
        
$('.clock-instance').draggable({
            handle: ".clock-header",
            containment: "document",
            // *** 添加此行：忽略发生在 .clock-title 上的点击事件 ***
            cancel: ".clock-title"
        });

        applyGlobalSettings(); 

    })();
});