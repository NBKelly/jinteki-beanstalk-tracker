// ==UserScript==
// @name         Beanteki
// @namespace    https://github.com/nbkelly/jinteki-beanstalk-tracker
// @version      2025-04-21
// @description  Shows bean scores on jinteki.net
// @author       nbkelly
// @match        *.jinteki.net
// @match        *.jinteki.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=jinteki.net
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @license      MIT
// @homepageURL  https://github.com/nbkelly
// ==/UserScript==

// Default: null means "all seasons"
let seasonId = GM_getValue('seasonId', '');

// Add menu command so user can change it
GM_registerMenuCommand("Set Season", () => {
    const current = GM_getValue('seasonId', '');
    const newSeason = prompt("Enter a season ID (current is '3' (lima beans), or leave blank for all seasons):", current);
    if (newSeason !== null) {
        GM_setValue('seasonId', newSeason);
        location.reload(); // refresh to re-fetch with new setting
    }
});

(function() {
    'use strict';

    const seasonId = GM_getValue('seasonId', '');

    let localSeason = ""
    if (seasonId && seasonId.trim() !== '') {
        localSeason = "?seasonId=" + seasonId.trim();
    }
    const apiURL = 'https://netrunner-beanstalk.net/api/leaderboard' + localSeason;

    function decorateUsernames(userMap) {
        const nodes = document.querySelectorAll('.name-box .username');

        nodes.forEach(node => {
            const name = node.textContent.trim();
            const userData = userMap[name];
            console.log("Name: ", name);

            if (!userData) return;
            if (node.dataset.enhanced) return;

            node.style.color = '#ffaa00'; // gold
            node.style.fondWeight = 'bold';
            node.style.position = 'relative';

            const tooltip = document.createElement('div')
            tooltip.className = "status-tooltip blue-shade"
            tooltip.innerHTML = `
              🏅 Rank: ${userData.rank}<br>
              🫘 Beans: ${userData.points.toFixed(2)}
            `;
            tooltip.style.cssText =`
              position: absolute;
              top: 100%;
              left: 0;
              border-radius: 6px;
              z-index: 9999;
              padding: 6px 10px;
              display: none;
              outline: 2px solid white;
              `

            node.appendChild(tooltip);

            node.addEventListener('mouseenter', () => tooltip.style.display = 'block');
            node.addEventListener('mouseleave', () => tooltip.style.display = 'none');

            node.dataset.enhanced = 'true';
        });
    }

    function decoratePlayers(userMap) {
        const users = document.querySelectorAll('span.user-status');
        users.forEach(span => {
            const nameNode = span.firstChild;
            if (!nameNode || nameNode.nodeType !== Node.TEXT_NODE) return;

            const username = nameNode.textContent.trim();
            const userData = userMap[username];

            if (!userData) return;

            const tooltip = span.querySelector('.status-tooltip');

            if (!tooltip.enhanced) {
                if(tooltip) {
                    // Style the player's name
                    span.style.fontWeight = 'bold';
                    span.style.color = '#ffaa00'; // gold

                    const rankDiv = document.createElement('div');
                    rankDiv.textContent = `🏅 Rank: ${userData.rank}`;
                    tooltip.appendChild(rankDiv);

                    const beansDiv = document.createElement('div');
                    beansDiv.textContent = `🫘 Beans: ${userData.points.toFixed(2)}`;
                    tooltip.appendChild(beansDiv);
                    tooltip.enhanced = "true";
                }
            }
        })}

    const userMetadata = {};

    fetch(apiURL)
        .then(response => response.json())
        .then(data => {
        console.log('Fetched beanstalk data!');

        data.forEach(user => {
            userMetadata[user.user_name] = {
                points: user.points,
                rank: user.rank
            };
        });
    })
        .catch(error => {console.error("API fetch failed:", error);});


    let decorateTimeout;
    function scheduleDecorate() {
        clearTimeout(decorateTimeout);
        decorateTimeout = setTimeout(() => {
            decoratePlayers(userMetadata);
        }, 250);
    }

    // Monitor fetch responses
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(response => {
            response.clone().text().then(body => {
                if (body.startsWith('[[[:lobby/list')) {
                    scheduleDecorate();
                }
            });
            return response;
        })
    };

    // Monitor XMLHttpRequest responses
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            if (this.responseText && this.responseText.startsWith('[[[:lobby/list')) {
                scheduleDecorate();
            }
            if (this.responseText && this.responseText.startsWith('[[[:game/diff')) {
                const now = Date.now();
                if (pendingTimeout) {
                    clearTimeout(pendingTimeout);
                    pendingTimeout = null;
                }

                // Throttle: at least 15s between updates
                if (now - lastUpdate > 15000) {
                    pendingTimeout = setTimeout(() => {
                        console.log('[LeaderboardUpdater] Triggering name update...');
                        decorateUsernames(userMetadata); // <-- your function here
                        lastUpdate = Date.now();
                        pendingTimeout = null;
                    }, 250); // wait quarter second
                }
            }
        });
        return send.apply(this, arguments);
    };

    // Keep track of timing to avoid over-refreshing
    let lastUpdate = 0;
    let pendingTimeout = null;

    const MIN_INTERVAL_MS = 15_000;
    const DELAY_MS = 3_000;
})();
