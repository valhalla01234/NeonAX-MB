(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const playerRadius = 14;
    const enemyRadius = 18;
    const keyRadius = 10;
    const playerSpeed = 3;
    const dashSpeed = 10;
    const dashDuration = 150;
    const dashCooldownTime = 2000;

    const menu = document.getElementById('menu');
    const startBtn = document.getElementById('startBtn');
    const startInfo = document.getElementById('startInfo');
    const infoBar = document.getElementById('info');
    const colorSelect = document.getElementById('colorSelect');
    const modeSelect = document.getElementById('modeSelect');
    const timerDisplay = document.getElementById('timer');
    const menuHighScore = document.getElementById('menuHighScore');
    const newRecordMsg = document.getElementById('newRecordMsg');

    const gameOverDiv = document.getElementById('gameOver');
    const levelUpDiv = document.getElementById('levelUp');
    const confirmQuitDiv = document.getElementById('confirmQuit');

    const joystickContainer = document.getElementById('joystick-container');
    const joystickBase = document.getElementById('joystick-base');
    const joystickHandle = document.getElementById('joystick-handle');
    const dashButton = document.getElementById('dash-button');
    const dashCooldownWrapper = document.getElementById('dash-cooldown-wrapper');
    const dashCooldownBar = document.getElementById('dash-cooldown-bar');
    const dashCooldownText = document.getElementById('dash-cooldown-text');

    let player = { x: width/2, y: height/2, dirX:0, dirY:0 };
    let enemies = [];
    let keys = [];

    let score = 0;
    let highScores = { classic: 0, timed: 0 };
    let level = 1;
    let gameOver = false;
    let levelUp = false;
    let invulnerable = true;
    let movedOnce = false;
    let inMenu = true;
    let collectedKeys = 0;
    let recordBeaten = false;

    let currentMode = 'classic';
    let timedModeTime = 30;
    let timedModeTimer = timedModeTime;
    let timedInterval = null;

    let dashCooldown = 0;
    let isDashing = false;
    let dashTimeout = null;
    let dashCooldownTimeout = null;

    let isDraggingJoystick = false;
    let joystickCenterX = 0;
    let joystickCenterY = 0;
    const joystickMaxDist = 50;

    let gameOverSelection = 0;
    let levelUpSelection = 0;
    let confirmQuitSelection = 0;

    let playerColor = 'blue';

    function isMobileDevice() {
        // Bu fonksiyon artık sadece dokunmatik cihazlar için değil, 
        // medya sorgusuyla beraber UI görünürlüğünü kontrol etmek için kullanılıyor.
        // Amaç mobil kontrolleri sadece küçük ekranlarda göstermek.
        return window.matchMedia("(max-width: 768px)").matches;
    }

    function loadHighScores() {
        const classicScore = localStorage.getItem('neonEscapeHighScore_classic');
        const timedScore = localStorage.getItem('neonEscapeHighScore_timed');
        highScores.classic = classicScore ? parseInt(classicScore) : 0;
        highScores.timed = timedScore ? parseInt(timedScore) : 0;
        updateMenuHighScore();
        updateInfoHighScore();
    }

    function updateMenuHighScore() {
        const scoreVal = highScores[currentMode] || 0;
        menuHighScore.innerText = "High Score: " + scoreVal;
    }

    function updateInfoHighScore() {
        const scoreVal = highScores[currentMode] || 0;
        document.getElementById('highScore').innerText = scoreVal;
    }

    function saveHighScore() {
        if(score > (highScores[currentMode] || 0)) {
            highScores[currentMode] = score;
            localStorage.setItem('neonEscapeHighScore_' + currentMode, score);
            updateMenuHighScore();
            updateInfoHighScore();
            recordBeaten = true;
        } else {
            recordBeaten = false;
        }
    }

    function distance(x1,y1,x2,y2) {
        return Math.hypot(x2-x1, y2-y1);
    }
    function randomSpeed() {
        let s = Math.random()*2 + 1;
        return Math.random() < 0.5 ? s : -s;
    }

    function spawnEnemies(count) {
        enemies = [];
        for(let i=0; i<count; i++) {
            let ex, ey;
            let tries=0;
            do {
                ex = Math.random()*(width-2*enemyRadius)+enemyRadius;
                ey = Math.random()*(height-2*enemyRadius)+enemyRadius;
                tries++;
                if(tries>500) break;
            } while(
                distance(ex, ey, player.x, player.y) < 120 || 
                keys.some(c => distance(ex, ey, c.x, c.y) < 60)
            );
            enemies.push({
                x: ex,
                y: ey,
                speedX: randomSpeed(),
                speedY: randomSpeed(),
                radius: enemyRadius,
            });
        }
    }
    function spawnKeys(count) {
        keys = [];
        collectedKeys = 0;
        for(let i=0; i<count; i++) {
            let kx, ky;
            let tries = 0;
            do {
                kx = Math.random()*(width-2*keyRadius)+keyRadius;
                ky = Math.random()*(height-2*keyRadius)+keyRadius;
                tries++;
                if(tries>500) break;
            } while(
                distance(kx, ky, player.x, player.y) < 80 || 
                keys.some(c => distance(kx, ky, c.x, c.y) < 60) ||
                enemies.some(e => distance(kx, ky, e.x, e.y) < 60)
            );
            keys.push({x: kx, y: ky, radius: keyRadius});
        }
        updateCollectedKeys();
    }
    function spawnSingleKey() {
        keys = [];
        let kx, ky;
        let tries = 0;
        do {
            kx = Math.random()*(width-2*keyRadius)+keyRadius;
            ky = Math.random()*(height-2*keyRadius)+keyRadius;
            tries++;
            if(tries>500) break;
        } while(
            distance(kx, ky, player.x, player.y) < 80 || 
            enemies.some(e => distance(kx, ky, e.x, e.y) < 60)
        );
        keys.push({x: kx, y: ky, radius: keyRadius});
        updateCollectedKeys();
    }

    function movePlayer() {
        if(gameOver || levelUp || inMenu) return;
        
        let currentSpeed = isDashing ? dashSpeed : playerSpeed;
        
        if(player.dirX !== 0 || player.dirY !== 0) {
            if(!movedOnce) {
                movedOnce = true;
                invulnerable = false;
                hideStartInfo();
            }
            let len = Math.hypot(player.dirX, player.dirY);
            player.dirX /= len;
            player.dirY /= len;
            let nx = player.x + player.dirX * currentSpeed;
            let ny = player.y + player.dirY * currentSpeed;
            
            if(nx-playerRadius < 0) nx = playerRadius;
            if(nx+playerRadius > width) nx = width - playerRadius;
            if(ny-playerRadius < 0) ny = playerRadius;
            if(ny+playerRadius > height) ny = height - playerRadius;
            player.x = nx;
            player.y = ny;
        }
    }

    function moveEnemies() {
        if(gameOver || levelUp || inMenu) return;
        enemies.forEach(e => {
            if(Math.random() < 0.02) {
                e.speedX = randomSpeed();
                e.speedY = randomSpeed();
            }
            e.x += e.speedX;
            e.y += e.speedY;
            if(e.x - enemyRadius < 0) { e.x = enemyRadius; e.speedX *= -1; }
            if(e.x + enemyRadius > width) { e.x = width - enemyRadius; e.speedX *= -1; }
            if(e.y - enemyRadius < 0) { e.y = enemyRadius; e.speedY *= -1; }
            if(e.y + enemyRadius > height) { e.y = height - enemyRadius; e.speedY *= -1; }
        });
    }

    function checkCollisions() {
        if(gameOver || levelUp || inMenu) return;

        if(!invulnerable && !isDashing) { 
            for(let e of enemies) {
                if(distance(player.x, player.y, e.x, e.y) < playerRadius + e.radius) {
                    triggerGameOver();
                    return;
                }
            }
        }

        for(let i=keys.length-1; i>=0; i--) {
            if(distance(player.x, player.y, keys[i].x, keys[i].y) < playerRadius + keys[i].radius) {
                keys.splice(i,1);
                score += 10;
                collectedKeys++;
                updateScore();
                updateCollectedKeys();

                if(currentMode === 'classic') {
                    if(collectedKeys >= 5) {
                        triggerLevelUp();
                    }
                } else if(currentMode === 'timed') {
                    spawnSingleKey();
                    timedModeTimer = timedModeTime;
                    updateTimerDisplay();
                }
            }
        }
    }

    function drawPlayer() {
        ctx.save();
        ctx.translate(player.x, player.y);

        ctx.fillStyle = playerColor;
        ctx.shadowColor = playerColor;
        ctx.shadowBlur = isDashing ? 30 : 15;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 5;
        const eyeRadius = 5;
        const eyeSpacing = 10;
        ctx.beginPath();
        ctx.ellipse(-eyeSpacing/2, 0, eyeRadius, eyeRadius*1.2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(eyeSpacing/2, 0, eyeRadius, eyeRadius*1.2, 0, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }

    function drawEnemies() {
        enemies.forEach(e => {
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.fillStyle = '#a200ff';
            ctx.shadowColor = '#a200ff';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(0, 0, e.radius, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        });
    }

    function drawKeys() {
        keys.forEach(k => {
            ctx.save();
            ctx.translate(k.x, k.y);
            ctx.fillStyle = '#0f0';
            ctx.shadowColor = '#0f0';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            const size = k.radius * 2;
            ctx.fillRect(-k.radius, -k.radius, size, size);
            ctx.restore();
        });
    }

    function clearScreen() {
        ctx.clearRect(0, 0, width, height);
    }

    function updateScore() {
        document.getElementById('score').innerText = score;
        updateInfoHighScore();
    }
    function updateLevel() {
        document.getElementById('level').innerText = level;
    }
    function updateCollectedKeys() {
        document.getElementById('collected').innerText = collectedKeys;
    }
    function updateTimerDisplay() {
        timerDisplay.innerText = "Time: " + timedModeTimer;
    }

    function showStartInfo() {
        startInfo.style.display = 'block';
    }
    function hideStartInfo() {
        startInfo.style.display = 'none';
    }

    function resetGame() {
        currentMode = modeSelect.value;
        playerColor = colorSelect.value;
        recordBeaten = false;

        score = 0;
        level = 1;
        collectedKeys = 0;
        movedOnce = false;
        invulnerable = true;
        player.x = width/2;
        player.y = height/2;
        player.dirX = 0;
        player.dirY = 0;

        isDashing = false;
        dashCooldown = 0;
        clearTimeout(dashTimeout);
        clearTimeout(dashCooldownTimeout);
        updateDashCooldownBar();

        if(currentMode === 'classic') {
            spawnEnemies(level + 2);
            spawnKeys(5);
            timerDisplay.style.display = 'none';
            if(timedInterval) {
                clearInterval(timedInterval);
                timedInterval = null;
            }
        } else if(currentMode === 'timed') {
            spawnEnemies(15);
            spawnSingleKey();
            timedModeTimer = timedModeTime;
            timerDisplay.style.display = 'inline-block';
            startTimedModeTimer();
        }

        gameOver = false;
        levelUp = false;
        inMenu = false;
        updateScore();
        updateLevel();
        updateCollectedKeys();
        updateMenuHighScore();

        showStartInfo();
    }

    function startTimedModeTimer() {
        if(timedInterval) clearInterval(timedInterval);
        timedInterval = setInterval(() => {
            if(gameOver || levelUp || inMenu) {
                clearInterval(timedInterval);
                timedInterval = null;
                return;
            }
            timedModeTimer--;
            updateTimerDisplay();
            if(timedModeTimer <= 0) {
                triggerGameOver();
            }
        }, 1000);
    }

    function triggerLevelUp() {
        levelUp = true;
        inMenu = true;
        levelUpSelection = 0;
        levelUpDiv.style.display = 'block';
        infoBar.style.display = 'none';
        startInfo.style.display = 'none';
        gameOverDiv.style.display = 'none';
        confirmQuitDiv.style.display = 'none';
        dashCooldownWrapper.style.display = 'none';

        saveHighScore();
        updateLevel();

        setupOverlayOptions(levelUpDiv, 'levelUpSelection');
        updateSelectionHighlight(levelUpDiv, levelUpSelection);
    }

    function triggerGameOver() {
        gameOver = true;
        inMenu = true;
        gameOverSelection = 0;
        gameOverDiv.style.display = 'block';
        infoBar.style.display = 'none';
        startInfo.style.display = 'none';
        levelUpDiv.style.display = 'none';
        confirmQuitDiv.style.display = 'none';
        dashCooldownWrapper.style.display = 'none';

        saveHighScore();

        if(recordBeaten) {
            newRecordMsg.style.display = 'block';
        } else {
            newRecordMsg.style.display = 'none';
        }

        if(timedInterval) {
            clearInterval(timedInterval);
            timedInterval = null;
        }
        clearTimeout(dashTimeout);
        clearTimeout(dashCooldownTimeout);

        setupOverlayOptions(gameOverDiv, 'gameOverSelection');
        updateSelectionHighlight(gameOverDiv, gameOverSelection);
    }

    function draw() {
        clearScreen();
        drawKeys();
        drawEnemies();
        drawPlayer();
    }

    function gameLoop() {
        if(!gameOver && !levelUp && !inMenu) {
            movePlayer();
            moveEnemies();
            checkCollisions();
        }
        draw();
        requestAnimationFrame(gameLoop);
    }

    function updateSelectionHighlight(container, selectedIndex) {
        const options = container.querySelectorAll('.option');
        options.forEach((opt, idx) => {
            if(idx === selectedIndex) opt.classList.add('selected');
            else opt.classList.remove('selected');
        });
    }

    function setupOverlayOptions(container, selectionVarName) {
        const options = container.querySelectorAll('.option');
        options.forEach((opt, index) => {
            // Önceki olay dinleyicilerini kaldır, mükerrerliği önlemek için
            opt.removeEventListener('click', handleOptionClick);
            opt.removeEventListener('touchstart', handleOptionClick);

            // Hem fare tıklaması hem de dokunmatik ekran için olay dinleyicileri ekle
            opt.addEventListener('click', handleOptionClick);
            opt.addEventListener('touchstart', handleOptionClick); // Dokunmatik cihazlar için
            
            opt.dataset.index = index;
            opt.dataset.containerId = container.id;
            opt.dataset.selectionVarName = selectionVarName;
        });
    }

    function handleOptionClick(e) {
        // Eğer olay bir dokunmatik (touch) olay ise varsayılan davranışı engelle
        if (e.type === 'touchstart' || e.type === 'touchmove' || e.type === 'touchend') {
            e.preventDefault(); 
        }

        const targetOption = e.currentTarget;
        const index = parseInt(targetOption.dataset.index);
        const containerId = targetOption.dataset.containerId;
        const selectionVarName = targetOption.dataset.selectionVarName;

        if (selectionVarName === 'gameOverSelection') {
            gameOverSelection = index;
        } else if (selectionVarName === 'levelUpSelection') {
            levelUpSelection = index;
        } else if (selectionVarName === 'confirmQuitSelection') {
            confirmQuitSelection = index;
        }

        const action = targetOption.dataset.action;

        if(containerId === 'gameOver') {
            if(action === 'retry') {
                gameOverDiv.style.display = 'none';
                resetGame();
                infoBar.style.display = 'block';
                startInfo.style.display = 'block';
                dashCooldownWrapper.style.display = 'flex';
            } else if(action === 'menu') {
                gameOverDiv.style.display = 'none';
                showMenu();
            }
        } else if(containerId === 'levelUp') {
            if(action === 'next') {
                levelUpDiv.style.display = 'none';
                level++;
                spawnEnemies(level + 2);
                spawnKeys(5);
                collectedKeys = 0;
                score += 50;
                updateScore();
                updateLevel();
                levelUp = false;
                inMenu = false;
                invulnerable = true;
                movedOnce = false;
                player.x = width/2;
                player.y = height/2;
                player.dirX = 0;
                player.dirY = 0;
                showStartInfo();
                infoBar.style.display = 'block';
                dashCooldownWrapper.style.display = 'flex';
                if(currentMode === 'timed') {
                    timedModeTimer = timedModeTime;
                    updateTimerDisplay();
                    startTimedModeTimer();
                } else {
                    timerDisplay.style.display = 'none';
                    if(timedInterval) {
                        clearInterval(timedInterval);
                        timedInterval = null;
                    }
                }
            } else if(action === 'menu') {
                levelUpDiv.style.display = 'none';
                showMenu();
            }
        } else if(containerId === 'confirmQuit') {
            if(action === 'yes') {
                confirmQuitDiv.style.display = 'none';
                showMenu();
            } else {
                confirmQuitDiv.style.display = 'none';
                inMenu = false;
                infoBar.style.display = 'block';
                dashCooldownWrapper.style.display = 'flex';
                if(currentMode === 'timed' && timedInterval === null) {
                    startTimedModeTimer();
                }
            }
        }
    }

    // Start butonu için de aynı koşullu preventDefault uygulamasını yapalım
    startBtn.addEventListener('click', startGame);
    startBtn.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Sadece dokunmatik olaylar için varsayılan davranışı engelle
        startGame(e);
    });

    function startGame(e) {
        // startGame'in kendisi e.preventDefault() içermeyecek, sadece çağıran event listener'lar içerecek.
        hideMenu();
        resetGame();
        infoBar.style.display = 'block';
        startInfo.style.display = 'block';
        dashCooldownWrapper.style.display = 'flex';
    }

    modeSelect.addEventListener('change', () => {
        currentMode = modeSelect.value;
        updateMenuHighScore();
        updateInfoHighScore();
    });
    colorSelect.addEventListener('change', () => {
        playerColor = colorSelect.value;
    });

    function showMenu() {
        inMenu = true;
        menu.style.display = 'block';
        gameOverDiv.style.display = 'none';
        levelUpDiv.style.display = 'none';
        confirmQuitDiv.style.display = 'none';
        infoBar.style.display = 'none';
        startInfo.style.display = 'none';
        dashCooldownWrapper.style.display = 'none';
        updateMenuHighScore();

        // **BURASI DEĞİŞTİ:** Olay dinleyicilerini sadece bir kez ekliyoruz ve kaldırma mantığını basitleştiriyoruz.
        // `startBtn`'in olay dinleyicileri zaten dosya yüklendiğinde bir kez ekleniyor.
        // Menü gösterildiğinde tekrar tekrar eklemeye gerek yok, hatta sorun yaratabilir.
        // Bu yüzden aşağıdaki iki satırı yorum satırı yapıyoruz/siliyoruz.
        // startBtn.removeEventListener('click', startGame);
        // startBtn.removeEventListener('touchstart', (e) => { e.preventDefault(); startGame(e); });
        
        // Bu iki satır zaten dosya yüklendiğinde bir kez çalışıyor, burada tekrara gerek yok
        // startBtn.addEventListener('click', startGame); 
        // startBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startGame(e); }); 
    }

    function hideMenu() {
        inMenu = false;
        menu.style.display = 'none';
    }

    function pauseAndConfirmQuit() {
        if(inMenu || gameOver || levelUp) return;
        inMenu = true;
        confirmQuitSelection = 0;
        confirmQuitDiv.style.display = 'block';
        infoBar.style.display = 'none';
        startInfo.style.display = 'none';
        dashCooldownWrapper.style.display = 'none';
        if(timedInterval) {
            clearInterval(timedInterval);
            timedInterval = null;
        }
        clearTimeout(dashTimeout);
        clearTimeout(dashCooldownTimeout);

        setupOverlayOptions(confirmQuitDiv, 'confirmQuitSelection');
        updateSelectionHighlight(confirmQuitDiv, confirmQuitSelection);
    }

    function initMobileControls() {
        if (isMobileDevice()) { // Sadece mobil cihazlarda görünecek
            joystickContainer.style.display = 'block';
            dashButton.style.display = 'block';
            
            const baseRect = joystickBase.getBoundingClientRect();
            joystickCenterX = baseRect.left + baseRect.width / 2;
            joystickCenterY = baseRect.top + baseRect.height / 2;

            joystickHandle.style.left = '50%';
            joystickHandle.style.top = '50%';
            joystickHandle.style.transform = 'translate(-50%, -50%)';

            joystickHandle.addEventListener('pointerdown', startDrag);
            joystickHandle.addEventListener('touchstart', startDrag);

            dashButton.addEventListener('pointerdown', handleDashClick);
            dashButton.addEventListener('touchstart', handleDashClick);
        } else { // Masaüstü cihazlarda gizle
            joystickContainer.style.display = 'none';
            dashButton.style.display = 'none';
        }
    }

    function startDrag(e) {
        // Sadece dokunmatik veya kalem olayları için preventDefault
        if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.type === 'touchstart') {
            e.preventDefault();
        }
        isDraggingJoystick = true;
        // Pointer Capture: Özellikle dokunmatik ve kalem girişlerinde, 
        // parmak ekrandan kalkana kadar olayları bu elemente kilitlemeyi sağlar.
        joystickHandle.setPointerCapture ? joystickHandle.setPointerCapture(e.pointerId) : null;
        document.addEventListener('pointermove', drag);
        document.addEventListener('pointerup', endDrag);
        document.addEventListener('touchmove', drag); // Dokunmatik için
        document.addEventListener('touchend', endDrag); // Dokunmatik için
    }

    function drag(e) {
        if (!isDraggingJoystick) return;
        
        // Sadece dokunmatik veya kalem olayları için preventDefault
        if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.type === 'touchmove') {
            e.preventDefault();
        }

        // Fare veya dokunmatik olayı için koordinatları al
        let clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
        let clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);

        let deltaX = clientX - joystickCenterX;
        let deltaY = clientY - joystickCenterY;
        let distance = Math.hypot(deltaX, deltaY);

        if (distance > joystickMaxDist) {
            deltaX = (deltaX / distance) * joystickMaxDist;
            deltaY = (deltaY / distance) * joystickMaxDist;
        }

        joystickHandle.style.transform = `translate(-50%, -50%) translate(${deltaX}px, ${deltaY}px)`;

        // Oyuncu yönünü ayarla
        player.dirX = deltaX / joystickMaxDist;
        player.dirY = deltaY / joystickMaxDist;
        
        // İlk hareketle dokunulmazlığı kaldır
        if (!movedOnce && (player.dirX !== 0 || player.dirY !== 0)) {
            movedOnce = true;
            invulnerable = false;
            hideStartInfo();
        }
    }

    function endDrag(e) {
        isDraggingJoystick = false;
        // Pointer Capture'ı serbest bırak
        joystickHandle.releasePointerCapture ? joystickHandle.releasePointerCapture(e.pointerId) : null;
        document.removeEventListener('pointermove', drag);
        document.removeEventListener('pointerup', endDrag);
        document.removeEventListener('touchmove', drag); // Dokunmatik için
        document.removeEventListener('touchend', endDrag); // Dokunmatik için

        joystickHandle.style.transform = 'translate(-50%, -50%)';
        
        // Oyuncu yönünü sıfırla
        player.dirX = 0;
        player.dirY = 0;
    }

    function startDash() {
        if (dashCooldown === 0 && !isDashing) {
            isDashing = true;
            dashCooldown = dashCooldownTime;
            dashCooldownWrapper.style.backgroundColor = 'rgba(255,0,0,0.5)';
            dashCooldownText.innerText = 'DASHING!';
            
            dashTimeout = setTimeout(() => {
                isDashing = false;
                dashCooldownText.innerText = 'COOLDOWN';
                updateDashCooldownBar();
            }, dashDuration);

            dashCooldownTimeout = setTimeout(() => {
                dashCooldown = 0;
                dashCooldownWrapper.style.backgroundColor = 'rgba(0, 255, 0, 0.5)';
                dashCooldownText.innerText = 'Dash Ready!';
                updateDashCooldownBar();
            }, dashCooldownTime);
        }
    }

    function handleDashClick(e) {
        // Sadece dokunmatik veya kalem olayları için varsayılan davranışı engelle
        if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.type === 'touchstart') {
            e.preventDefault(); 
        }
        startDash();
    }

    function updateDashCooldownBar() {
        if (dashCooldown === 0) {
            dashCooldownBar.style.width = '100%';
            dashCooldownBar.style.backgroundColor = '#0f0';
            dashCooldownText.innerText = 'Dash Ready!';
        } else {
            const progress = (dashCooldownTime - dashCooldown) / dashCooldownTime;
            dashCooldownBar.style.width = `${progress * 100}%`;
            dashCooldownBar.style.backgroundColor = isDashing ? '#f0f' : '#f00';
            dashCooldownText.innerText = isDashing ? 'DASHING!' : 'COOLDOWN';
        }
    }

    setInterval(() => {
        if (dashCooldown > 0 && !isDashing) {
            dashCooldown -= 100;
            if (dashCooldown < 0) dashCooldown = 0;
            updateDashCooldownBar();
        }
    }, 100);

    // Klavye kontrolü için olay dinleyicileri (önceden vardı)
    document.addEventListener('keydown', e => {
        if(inMenu) {
            const currentOverlay = document.querySelector('.overlay[style*="display: block"]');
            if(currentOverlay) {
                let selectionVar;
                if(currentOverlay.id === 'gameOver') selectionVar = 'gameOverSelection';
                else if(currentOverlay.id === 'levelUp') selectionVar = 'levelUpSelection';
                else if(currentOverlay.id === 'confirmQuit') selectionVar = 'confirmQuitSelection';

                const options = currentOverlay.querySelectorAll('.option');
                let currentIndex = window[selectionVar];

                if(e.key === 'ArrowUp') {
                    currentIndex = (currentIndex - 1 + options.length) % options.length;
                    window[selectionVar] = currentIndex;
                    updateSelectionHighlight(currentOverlay, currentIndex);
                } else if(e.key === 'ArrowDown') {
                    currentIndex = (currentIndex + 1) % options.length;
                    window[selectionVar] = currentIndex;
                    updateSelectionHighlight(currentOverlay, currentIndex);
                } else if(e.key === 'Enter') {
                    options[currentIndex].click(); // Seçilen seçeneği tetikle
                }
            } else if(menu.style.display === 'block') { // Ana menüde ENTER tuşu
                if(e.key === 'Enter') {
                    startBtn.click();
                }
            }
            return;
        }

        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') player.dirY = -1;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') player.dirY = 1;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') player.dirX = -1;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') player.dirX = 1;
        if (e.key === ' ' && !isDashing) startDash(); // Boşluk tuşu ile dash
        if (e.key === 'Escape' && !inMenu) pauseAndConfirmQuit(); // ESC ile duraklatma
    });

    document.addEventListener('keyup', e => {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp' || 
            e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') player.dirY = 0;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft' || 
            e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') player.dirX = 0;
    });

    // Sayfa yüklendiğinde çalışacak fonksiyonlar
    loadHighScores(); // Yüksek skorları yükle
    showMenu(); // Menüyü göster
    initMobileControls(); // Mobil kontrolleri başlat (şimdi ekran boyutuna göre otomatik açılacak)

    gameLoop(); // Ana oyun döngüsünü başlat
})();