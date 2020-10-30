// ==UserScript==
// @name         Colorful Leaderboard
// @namespace    bl4ckscor3
// @version      0.4.1
// @description  Shows player role information on EyeWire's leaderboard and adds a couple QoL features
// @author       bl4ckscor3
// @match        https://eyewire.org/
// @grant        none
// @updateURL    https://raw.githubusercontent.com/bl4ckscor3/ColorfulLeaderboard/master/colorfulleaderboard.user.js
// @downloadURL  https://raw.githubusercontent.com/bl4ckscor3/ColorfulLeaderboard/master/colorfulleaderboard.user.js
// @homepageURL  https://github.com/bl4ckscor3/ColorfulLeaderboard
// ==/UserScript==

/* globals $ account leaderboard */

(function() {
    'use strict';

    const Roles = {
        player: "Player",
        advancedPlayer: "Advanced Player",
        scout: "Scout",
        scythe: "Scythe",
        mystic: "Mystic",
        admin: "Admin"
    };
    const Settings = {
        showCrests: "show-crests",
        markModsMentors: "mark-mods-mentors",
        reorderFlags: "reorder-flags",
        hideLeaderboard: "hide-leaderboard"
    };
    const checkAccount = setInterval(function() {
        if(typeof account === "undefined" || !account.account.uid) { //is the account accessible yet?
            return; //if not, try again
        }

        clearInterval(checkAccount); //if yes, stop trying and start the actual script
        main();
    }, 100);
    const settingsCheck = setInterval(initSettings, 100);
    //key: playername, value: {highestRole, isMod, isMentor}
    const loadedPlayers = new Map();
    const leaderboardObserver = new MutationObserver(colorPlayers);

    leaderboardObserver.observe(document.getElementById("leaderboard"), {
        childList: true,
        attributes: false,
        characterData: false,
        subtree: false
    });
    resizeLeaderboard();
    resizeCubesPanel();

    function main() {
        if(getLocalSetting(Settings.hideLeaderboard, false)) {
            $("#dismiss-leaderboard").click();
        }
    }

    function colorPlayers(mutations) { //the leaderboard mutates only when it is reloaded, so mutations only contains the leaderboard entries
        if(mutations.length === 0) {
            return;
        }

        if(leaderboard.crew_id !== null) { //there's a competition being displayed, so only care about reordering flags
            for(let i = 0; i < mutations.length; i++) {
                if(mutations[i] && mutations[i].addedNodes.length !== 0) { //only care about mutations where a node has been added
                    reorderFlag(mutations[i].addedNodes[0].childNodes[1]);
                }
            }

            return;
        }

        //request the leaderboard to get the full names of players (sometimes, names are cut off using ...)
        let request = leaderboard.country ? `/1.0/stats/top/user/in/country/${leaderboard.country}/by/points/per/` : "/1.0/stats/top/user/by/points/per/";

        $.getJSON(request + leaderboard.timeframe, function(data) {
            let mutationsIndex = 0;

            for(let i = 0; i < data.length; i++) {
                if(mutations[mutationsIndex] && mutations[mutationsIndex].addedNodes.length === 0) { //only care about mutations where a node has been added
                    mutationsIndex++;
                }

                let indexToUse = mutationsIndex++;

                if(!mutations[indexToUse]) {
                    continue;
                }

                processPlayer(data, mutations[indexToUse], data[i].username);
            }
        });
    }

    function processPlayer(data, element, name) {
        if(!element || element.addedNodes.length === 0) {
            return;
        }

        let entry = element.addedNodes[0]; //<div class="leaderRow">...</div>
        let nameSpan = entry.childNodes[1]; //<span><span>name</span><img ...></span>

        if(loadedPlayers.has(name)) {
            updatePlayer(nameSpan, loadedPlayers.get(name));
        }
        else {
            $.getJSON(`/1.0/player/${name}/bio`, function(data) {
                let highestRole = Roles.player;
                let roles = data.roles;
                let isMod = false;
                let isMentor = false;

                if(roles.length !== 0) {
                    let isAdmin = false;

                    if(roles.includes("admin")) {
                        highestRole = Roles.admin;
                        isAdmin = true;
                    }
                    else if(roles.includes("mystic")) {
                        highestRole = Roles.mystic;
                    }
                    else if(roles.includes("scythe")) {
                        highestRole = Roles.scythe;
                    }
                    else if(roles.includes("scout")) {
                        highestRole = Roles.scout;
                    }

                    if(roles.includes("moderator") || isAdmin) { //always mark admins as moderators
                        isMod = true;
                    }

                    if(roles.includes("mentor") || isAdmin) { //always mark admins as mentors
                        isMentor = true;
                    }
                }
                else if(data.level === 2) {
                    highestRole = Roles.advancedPlayer;
                }

                saveAndUpdatePlayer(nameSpan, name, {highestRole: highestRole, isMod: isMod, isMentor: isMentor});
            }).fail(function() {
                console.warn(`Failed to color ${name} in the leaderboard, falling back to level 1 player.`);
                saveAndUpdatePlayer(nameSpan, name, {highestRole: Roles.player, isMod: false, isMentor: false});
            });
        }
    }

    function saveAndUpdatePlayer(element, playerName, data) {
        updatePlayer(element, data);
        loadedPlayers.set(playerName, data);
    }

    function updatePlayer(element, data) {
        updatePlayerIcon(element, data);
        updatePlayerInfo(element, data.isMod, data.isMentor);
        reorderFlag(element);
    }

    function updatePlayerIcon(element, data) {
        if(getLocalSetting(Settings.showCrests, true) && leaderboard.competition_id === null) { //do not add role icons during competitions
            let flagImg = element.childNodes[1] ? element.childNodes[1].cloneNode() : null; //not all users have a flag set
            let crestElem = document.createElement("img");
            let flagCrestSpan = document.createElement("span");

            if(flagImg) {
                element.childNodes[1].remove(); //remove the old flag
                flagCrestSpan.appendChild(flagImg);
            }

            crestElem.src = getCrestImage(data.highestRole);
            crestElem.width = 15;
            crestElem.height = 15;
            crestElem.title = data.highestRole;

            if(data.isMod && data.isMentor) {
                crestElem.title += ", Moderator, & Mentor";
            }
            else if(data.isMod) {
                crestElem.title += " & Moderator";
            }
            else if(data.isMentor) {
                crestElem.title += " & Mentor";
            }

            crestElem.setAttribute("class", "playerRoleCrest");
            flagCrestSpan.appendChild(crestElem);
            element.appendChild(flagCrestSpan);
        }
    }

    function updatePlayerInfo(element, isMod, isMentor) {
        if(getLocalSetting(Settings.markModsMentors, false) && leaderboard.competition_id === null) { //do not style names during competitions
            //mark the name italics and underline for mod/mentor
            var textStyle = `color: ${element.childNodes[0].style.color};`;

            if(isMod) {
                textStyle += "font-style: italic;";
            }

            if(isMentor) {
                textStyle += "text-decoration: underline;";
            }

            element.childNodes[0].style = textStyle;
        }
    }

    function reorderFlag(element) {
        if(element && getLocalSetting(Settings.reorderFlags, true)) {
            let flagImg = element.childNodes[1] ? element.childNodes[1].cloneNode(true) : null; //not all users have a flag set
            let noLeftMargin = "margin-left: 0px;";

            if(flagImg) {
                element.childNodes[1].remove();
                flagImg.setAttribute("style", noLeftMargin + "margin-right: 5px");

                if(flagImg.childNodes.length === 1) { //for displaying the crests at the correct position even if the player has no flag set
                    let placeholder = document.createElement("span");

                    placeholder.setAttribute("style", noLeftMargin + "margin-right: 21px");
                    flagImg.prepend(placeholder);
                }
            }
            else {
                flagImg = document.createElement("span"); //placeholder
                flagImg.setAttribute("style", noLeftMargin + "margin-right: 21px");
            }

            element.prepend(flagImg);
        }
    }

    function resizeLeaderboard() {
        const widerLeaderboardStyle = document.createElement("style");
        const usernameColumnWidth = ".leaderRowHeader span:nth-child(2), .leaderRow span:nth-child(2) {width: 160px;}"; //increases username column width
        const wideLeaderboard = ".ovlbContainer {width: 310px;}"; //increases leaderboard width
        const normalLeaderboard = ".ovlbContainer {width: 280px;}"; //default leaderboard width

        widerLeaderboardStyle.setAttribute("id", "widerLeaderboard");
        widerLeaderboardStyle.innerHTML = usernameColumnWidth + wideLeaderboard;
        document.head.appendChild(widerLeaderboardStyle);

        //fixes the leaderboard not completely disappearing off the screen when dismissed
        document.getElementById("dismiss-leaderboard").onclick = function() {
            widerLeaderboardStyle.innerHTML = usernameColumnWidth + normalLeaderboard;
        }
        document.getElementById("recall-leaderboard").onclick = function() {
            widerLeaderboardStyle.innerHTML = usernameColumnWidth + wideLeaderboard;
        }
    }

    function resizeCubesPanel() {
        const playerAddons = JSON.parse(localStorage.getItem("playerAddons")); //used to check if the cubes addon is enabled so its display can be widened as well

        if(playerAddons) {
            for(let addon of playerAddons) {
                if(addon.name === "Cubes") {
                    const interval = setInterval(function() {
                        let cubesPanel = document.getElementById("ews-cubes-panel");

                        if(cubesPanel) {
                            clearInterval(interval);
                            cubesPanel.style.width = "310px"; //make the cubes panel the same width as the leaderboard

                            for(let tab of cubesPanel.getElementsByClassName("ews-cubes-tab")) {
                                tab.setAttribute("style", "margin-left: 6px"); //add more space between the tab buttons so they fill the whole width of the panel
                            }
                        }
                    }, 100);

                    return;
                }
            }
        }
    }

    //TODO: change these should the script be added officially
    function getCrestImage(role) {
        if(role === Roles.player) {
            return "https://i.imgur.com/CQkMiRN.png";//img/player.png";
        }
        else if(role === Roles.advancedPlayer) {
            return "https://i.imgur.com/NksbcD6.png";//img/advanced_player.png";
        }
        else if(role === Roles.scout) {
            return "https://i.imgur.com/nzsN4Ak.png";//img/scout.png";
        }
        else if(role === Roles.scythe) {
            return "https://i.imgur.com/71YeMfH.png";//img/scythe.png";
        }
        else if(role === Roles.mystic) {
            return "https://i.imgur.com/Xnd97Nw.png";//img/mystic.png";
        }
        else if(role === Roles.admin) {
            return "https://i.imgur.com/DiF3AUg.png";//img/admin.png";
        }
    }

    function initSettings() {
        if(!document.getElementById("cubeInspectorFloatingControls")) {
            return;
        }

        clearInterval(settingsCheck);

        var menu = document.getElementById("settingsMenu");
        var category = document.createElement("div");

        category.setAttribute("class", "settings-group ews-settings-group invisible");
        category.innerHTML = '<h1>Leaderboard</h1>';
        menu.appendChild(category);
        addToggleSetting(category, Settings.showCrests, "Show crests colored in players' highest rank's color", true);
        addToggleSetting(category, Settings.markModsMentors, "Mark moderators (italics) and mentors (underline)", false);
        addToggleSetting(category, Settings.reorderFlags, "Show flags and icons in front of players' names", true);
        addToggleSetting(category, Settings.hideLeaderboard, "Hide the leaderboard by default in the overview", false);
    }

    function addToggleSetting(category, id, description, defaultValue) {
        var state = getLocalSetting(id, defaultValue);
        var setting = document.createElement("div");
        var checkbox = document.createElement("checkbox");

        setting.setAttribute("class", "setting");
        setting.innerHTML = `<span>${description}</span>`;
        checkbox.setAttribute("class", `checkbox ${state ? "on" : "off"}`);
        checkbox.innerHTML = `
            <div class="checkbox-handle"></div>
            <input type="checkbox" id="clb-${id}" checked="${state ? "checked" : ""}" style="display: none;">`;
        setting.appendChild(checkbox);
        category.appendChild(setting);

        setting.onclick = function(e) {
            var toggle = setting.getElementsByTagName("input")[0];
            var newState = !toggle.checked;

            e.stopPropagation();
            setLocalSetting(id, newState);
            toggle.checked = newState;
            checkbox.setAttribute("class", `checkbox ${newState ? "on" : "off"}`);
            onSettingChanged(id, newState);
        };

        onSettingChanged(id, state);
    }

    function setLocalSetting(setting, value) {
        localStorage.setItem(account.account.uid + "-clb-" + setting, value);
    }

    function getLocalSetting(setting, defaultValue) {
        var storedValue = localStorage.getItem(account.account.uid + "-clb-" + setting);

        if(storedValue === null) {
            setLocalSetting(setting, defaultValue);
            return defaultValue;
        }
        else {
            return typeof defaultValue === "boolean" ? storedValue === "true" : storedValue;
        }
    }

    function onSettingChanged(id, state) { //trigger the ews-setting-changed event and update the lookup map with the new value
        $(document).trigger('ews-setting-changed', {setting: id, state: state});
    }
})();