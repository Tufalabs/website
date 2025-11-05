document.addEventListener('DOMContentLoaded', () => {
    const logo = document.getElementById('logo-image');
    const logoContainer = document.querySelector('.logo-container');
    const header = document.querySelector('header');
    let isSelecting = false;
    let isHovering = false;

    // Function to check if text is being selected
    function checkSelection() {
        return window.getSelection().toString().length > 0;
    }

    // Function to update logo position
    function updateLogoPosition(e) {
        if (!isSelecting) return;

        const logoRect = logo.getBoundingClientRect();
        const logoCenterX = logoRect.left + logoRect.width / 2;
        const logoCenterY = logoRect.top + logoRect.height / 2;

        const distanceX = e.clientX - logoCenterX;
        const distanceY = e.clientY - logoCenterY;
        const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);

        const maxDistance = 200;
        const maxMovement = 50;

        if (distance < maxDistance) {
            const movement = maxMovement * Math.pow((1 - distance / maxDistance), 3);
            const angleRad = Math.atan2(distanceY, distanceX);
            const moveX = -Math.cos(angleRad) * movement;
            const moveY = -Math.sin(angleRad) * movement;

            const rotation = isHovering ? 'rotate(2deg)' : '';
            logo.style.transform = `translate(${moveX}px, ${moveY}px) ${rotation}`;
        } else {
            logo.style.transform = isHovering ? 'rotate(2deg)' : 'translate(0, 0)';
        }
    }

    // Event listeners for hover effect
    logoContainer.addEventListener('mouseenter', () => {
        isHovering = true;
        if (!isSelecting) {
            logo.style.transform = 'rotate(5deg)';
        }
    });

    logoContainer.addEventListener('mouseleave', () => {
        isHovering = false;
        if (!isSelecting) {
            logo.style.transform = 'translate(0, 0)';
        }
    });

    // Event listener for mousedown
    document.addEventListener('mousedown', () => {
        isSelecting = false;
    });

    // Event listener for mousemove
    document.addEventListener('mousemove', (e) => {
        if (checkSelection()) {
            isSelecting = true;
            updateLogoPosition(e);
        } else if (isSelecting) {
            isSelecting = false;
            logo.style.transform = isHovering ? 'rotate(2deg)' : 'translate(0, 0)';
        }
    });

    // Event listener for mouseup
    document.addEventListener('mouseup', () => {
        setTimeout(() => {
            if (!checkSelection()) {
                isSelecting = false;
                logo.style.transform = isHovering ? 'rotate(2deg)' : 'translate(0, 0)';
            }
        }, 0);
    });

    // Event listener for when selection changes
    document.addEventListener('selectionchange', () => {
        if (!checkSelection()) {
            isSelecting = false;
            logo.style.transform = isHovering ? 'rotate(2deg)' : 'translate(0, 0)';
        }
    });

    // Reset logo position when mouse leaves the header
    header.addEventListener('mouseleave', () => {
        isHovering = false;
        isSelecting = false;
        logo.style.transform = 'translate(0, 0)';
    });
});


document.addEventListener('DOMContentLoaded', () => {
    const boss = document.getElementById('boss-image');
    const bossContainer = document.querySelector('.boss');
    const header = document.querySelector('header');
    let isSelecting = false;
    let isHovering = false;

    // Function to check if text is being selected
    function checkSelection() {
        return window.getSelection().toString().length > 0;
    }

    // Function to update boss position
    function updateBossPosition(e) {
        if (!isSelecting) return;

        const bossRect = boss.getBoundingClientRect();
        const bossCenterX = bossRect.left + bossRect.width / 2;
        const bossCenterY = bossRect.top + bossRect.height / 2;

        const distanceX = e.clientX - bossCenterX;
        const distanceY = e.clientY - bossCenterY;
        const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);

        const maxDistance = 200;
        const maxMovement = 50;

        if (distance < maxDistance) {
            const movement = maxMovement * Math.pow((1 - distance / maxDistance), 3);
            const angleRad = Math.atan2(distanceY, distanceX);
            const moveX = -Math.cos(angleRad) * movement;
            const moveY = -Math.sin(angleRad) * movement;

            const rotation = isHovering ? 'rotate(2deg)' : '';
            boss.style.transform = `translate(${moveX}px, ${moveY}px) ${rotation}`;
        } else {
            boss.style.transform = isHovering ? 'rotate(2deg)' : 'translate(0, 0)';
        }
    }

    // Event listeners for hover effect
    bossContainer.addEventListener('mouseenter', () => {
        isHovering = true;
        if (!isSelecting) {
            boss.style.transform = 'rotate(5deg)';
        }
    });

    bossContainer.addEventListener('mouseleave', () => {
        isHovering = false;
        if (!isSelecting) {
            boss.style.transform = 'translate(0, 0)';
        }
    });

    // Event listener for mousedown
    document.addEventListener('mousedown', () => {
        isSelecting = false;
    });

    // Event listener for mousemove
    document.addEventListener('mousemove', (e) => {
        if (checkSelection()) {
            isSelecting = true;
            updateBossPosition(e);
        } else if (isSelecting) {
            isSelecting = false;
            boss.style.transform = isHovering ? 'rotate(2deg)' : 'translate(0, 0)';
        }
    });

    // Event listener for mouseup
    document.addEventListener('mouseup', () => {
        setTimeout(() => {
            if (!checkSelection()) {
                isSelecting = false;
                boss.style.transform = isHovering ? 'rotate(2deg)' : 'translate(0, 0)';
            }
        }, 0);
    });

    // Event listener for when selection changes
    document.addEventListener('selectionchange', () => {
        if (!checkSelection()) {
            isSelecting = false;
            boss.style.transform = isHovering ? 'rotate(2deg)' : 'translate(0, 0)';
        }
    });

    // Reset boss position when mouse leaves the header
    header.addEventListener('mouseleave', () => {
        isHovering = false;
        isSelecting = false;
        boss.style.transform = 'translate(0, 0)';
    });
});
