// State
let currentPlaylist = [];
let currentSongIndex = 0;
let isPlaying = false;
let audio = new Audio();
// audio.crossOrigin = "anonymous"; // Commenting out to allow playback if server lacks CORS support
let currentView = 'home';

// DOM Elements
const views = {
    home: document.getElementById('home-view'),
    dashboard: document.getElementById('dashboard-view'),
    album: document.getElementById('album-view'),
    search: document.getElementById('search-view'),
    liked: document.getElementById('liked-view'),
    artist: document.getElementById('artist-view')
};

// Navigation History
let navHistory = [];
let isNavigatingBack = false;

// Library State
let library = JSON.parse(localStorage.getItem('neonLibrary')) || [];
let selectedLanguages = ['Hindi', 'English']; // Default
const allLanguages = [
    "Hindi", "English", "Punjabi", "Tamil", "Telugu",
    "Marathi", "Gujarati", "Bengali", "Kannada", "Bhojpuri",
    "Malayalam", "Sanskrit", "Haryanvi", "Rajasthani", "Odia", "Assamese"
];

// Liked Songs
let likedSongs = JSON.parse(localStorage.getItem('likedSongs')) || [];

function toggleLike(song) {
    const index = likedSongs.findIndex(s => s.id === song.id);
    if (index > -1) {
        likedSongs.splice(index, 1);
    } else {
        // Save full song object to avoid lookup issues later if data is dynamic
        // Or just ID. Using ID + basic info is safer. Let's save object for now as it's small app
        likedSongs.push(song);
    }
    localStorage.setItem('likedSongs', JSON.stringify(likedSongs));

    // Update UI if on Liked Page
    if (currentView === 'liked') {
        renderLikedSongs();
    }

    // Update buttons in current view
    updateLikeButtons(song.id);
}

function isLiked(songId) {
    return likedSongs.some(s => s.id === songId);
}

function updateLikeButtons(songId) {
    const btns = document.querySelectorAll(`.like-btn[data-id="${songId}"]`);
    btns.forEach(btn => {
        const liked = isLiked(songId);
        btn.innerHTML = liked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        btn.style.color = liked ? '#1db954' : '#b3b3b3';
        btn.classList.toggle('active', liked);
    });
}

const player = {
    playBtn: document.getElementById('play-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    title: document.getElementById('np-title'), // This element might not exist in new layout? checking...
    artist: document.getElementById('np-artist'), // This element might not exist in new layout? checking...
    video: document.getElementById('loop-video'),
    progressFill: document.getElementById('progress-fill'),
    currTime: document.getElementById('curr-time'),
    totalTime: document.getElementById('dur-time'), // Changed from total-time
    progressBar: document.getElementById('progress-container'), // Changed ID
    volumeSlider: document.getElementById('volume-slider')
};

// Initialization
function init() {
    renderHome();
    setupEventListeners();
    setupNavigation();
    setupLanguageModal();
    setupSortDropdown();
    loadPlayerState();
}

function setupEventListeners() {
    // Player Controls
    if (player.playBtn) player.playBtn.addEventListener('click', togglePlay);
    if (player.nextBtn) player.nextBtn.addEventListener('click', playNext);
    if (player.prevBtn) player.prevBtn.addEventListener('click', playPrev);

    // Back Button
    const backBtn = document.getElementById('nav-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', goBack);
    }

    // Full Screen Button
    const fsBtn = document.getElementById('fullscreen-btn');
    if (fsBtn) {
        fsBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                });
                fsBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                    fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
                }
            }
        });

        // Listen for escape key or other exit methods
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
            } else {
                fsBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
            }
        });
    }

    // New Controls Actions
    const shuffleBtn = document.getElementById('shuffle-btn');
    const loopBtn = document.getElementById('loop-btn');
    const muteBtn = document.getElementById('mute-btn');

    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            isShuffleOn = !isShuffleOn; // Update State!
            shuffleBtn.classList.toggle('active', isShuffleOn);
            shuffleBtn.style.color = isShuffleOn ? 'var(--primary-color)' : '#b3b3b3';
            if (typeof updateMiniPlayerUI === 'function') updateMiniPlayerUI();
        });
    }

    if (loopBtn) {
        loopBtn.addEventListener('click', () => {
            audio.loop = !audio.loop;
            loopBtn.style.color = audio.loop ? 'var(--primary-color)' : '#b3b3b3';
            if (typeof updateMiniPlayerUI === 'function') updateMiniPlayerUI();
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            // Logic handled by click
            audio.muted = !audio.muted;
            if (audio.muted) {
                muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
                if (player.volumeSlider) player.volumeSlider.value = 0;
            } else {
                muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                if (player.volumeSlider) player.volumeSlider.value = audio.volume || 1;
            }
            if (typeof updateMiniPlayerUI === 'function') updateMiniPlayerUI();
        });
    }

    if (player.volumeSlider) {
        player.volumeSlider.addEventListener('input', (e) => {
            audio.volume = e.target.value;
            if (audio.volume == 0) {
                audio.muted = true;
                if (muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            } else {
                audio.muted = false;
                if (muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            }
        });
    }

    // Audio Events
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', playNext);
    audio.addEventListener('loadedmetadata', () => {
        if (player.totalTime) player.totalTime.innerText = formatTime(audio.duration);
        if (typeof updateMiniPlayerUI === 'function') updateMiniPlayerUI();
    });
    audio.addEventListener('play', () => { if (typeof updateMiniPlayerUI === 'function') updateMiniPlayerUI(); });
    audio.addEventListener('pause', () => { if (typeof updateMiniPlayerUI === 'function') updateMiniPlayerUI(); });

    // Progress Bar Click
    if (player.progressBar) {
        player.progressBar.addEventListener('click', (e) => {
            const width = player.progressBar.clientWidth;
            const clickX = e.offsetX;
            const duration = audio.duration;
            audio.currentTime = (clickX / width) * duration;
        });
    }

    // Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
        sidebar.classList.toggle('closed');
        document.body.classList.toggle('sidebar-closed');
        document.querySelector('#toggle-sidebar').classList.toggle('fa-rotate-180');
    });

    // Library Dropdown
    const libMenu = document.getElementById('library-menu');
    const libSub = document.getElementById('library-submenu');
    libMenu.addEventListener('click', () => {
        libSub.classList.toggle('open');
        libMenu.querySelector('.dropdown-icon').classList.toggle('fa-chevron-up');
        libMenu.querySelector('.dropdown-icon').classList.toggle('fa-chevron-down');
    });

    // Filter Navigation (Library)
    document.querySelectorAll('.submenu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            if (filter === 'liked') {
                renderLikedSongs();
            } else {
                showLibrary(filter);
            }
        });
    });

    // Search
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length > 0) {
            handleSearch(query);
        } else {
            showView('home');
        }
    });

    // Playlist Creation
    document.getElementById('create-playlist-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('playlist-dialog').style.display = 'flex';
    });

    document.getElementById('cancel-playlist').addEventListener('click', () => {
        document.getElementById('playlist-dialog').style.display = 'none';
    });

    document.getElementById('save-playlist').addEventListener('click', () => {
        const name = document.getElementById('new-playlist-name').value;
        if (name) {
            playlists.push({ id: Date.now(), name: name, songs: [] });
            renderPlaylists();
            document.getElementById('playlist-dialog').style.display = 'none';
        }
    });

    // Mini Player
    const miniPlayerBtn = document.getElementById('mini-player-btn');
    if (miniPlayerBtn) {
        miniPlayerBtn.addEventListener('click', toggleMiniPlayer);
    }

    renderPlaylists();
}

function setupNavigation() {
    document.querySelectorAll('[data-target]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.target;
            showView(target);

            // Active State
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            if (link.classList.contains('menu-item')) link.classList.add('active');
        });
    });
}

function showView(viewId) {
    if (currentView === viewId) return; // Avoid duplicate moves

    // History Logic
    if (!isNavigatingBack && currentView) {
        navHistory.push(currentView);
    }
    isNavigatingBack = false; // Reset flag

    // Update UI
    Object.values(views).forEach(el => el.style.display = 'none');
    views[viewId].style.display = 'block';

    // Update State
    currentView = viewId;

    // Reset Library active state if leaving
    if (viewId !== 'dashboard') {
        // Optional: clear filters
    }
}
function goBack() {
    if (navHistory.length > 0) {
        const prev = navHistory.pop();
        isNavigatingBack = true; // Prevent pushing current view during back nav
        showView(prev);
    }
}

// Rendering Logic
function createCard(title, subtitle, image, onClick, itemData = null, type = 'general') {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
        <img src="${image}" loading="lazy" alt="${title}">
        <h3>${title}</h3>
        <p>${subtitle}</p>
        <div class="play-overlay"><i class="fa-solid fa-play"></i></div>
        <div class="card-menu-btn"><i class="fa-solid fa-ellipsis-vertical"></i></div>
    `;

    // Main Click
    div.addEventListener('click', (e) => {
        // Prevent click if menu clicked
        if (!e.target.closest('.card-menu-btn')) {
            onClick();
        }
    });

    // Menu Click
    const menuBtn = div.querySelector('.card-menu-btn');
    if (type === 'album' || type === 'playlist' || type === 'mix' || type === 'deep dive') {
        const menuType = (type === 'deep dive') ? 'album' : type; // Normalize for context menu handler
        menuBtn.addEventListener('click', (e) => {
            showContextMenu(e, itemData, menuType);
        });
    } else {
        menuBtn.style.display = 'none'; // Hide if not applicable
    }

    return div;
}

function renderHome() {

    // =========================
    // 🎵 MADE FOR YOU (ALBUMS)
    // =========================
    const grid = document.getElementById('featured-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Filter albums by selected languages (if album has language property)
    let filteredAlbums = albums.filter(album =>
        selectedLanguages.length === 0 ||
        selectedLanguages.includes(album.language)
    );

    // Fallback if no match
    if (filteredAlbums.length === 0) {
        filteredAlbums = albums.slice(0, 12);
    }

    filteredAlbums.slice(0, 12).forEach(album => {

        const card = createCard(
            album.title,
            album.artist,
            album.cover,
            () => openAlbum(album),  // 👈 open album page
            album,
            'album'
        );

        grid.appendChild(card);
    });



    // =========================
    // 📂 POPULAR PLAYLISTS
    // =========================
    const plGrid = document.getElementById('popular-playlists');
    if (plGrid) {
        plGrid.innerHTML = '';

        playlists.forEach(pl => {
            const cover =
                songs.find(s => s.id === pl.songs[0])?.cover ||
                'https://via.placeholder.com/150/b026ff/FFFFFF?text=PL';

            const card = createCard(
                pl.name,
                `${pl.songs.length} Songs`,
                cover,
                () => console.log('Open Playlist'),
                pl,
                'playlist'
            );

            plGrid.appendChild(card);
        });
    }



    // =========================
    // 👩‍🎤 ARTIST CAROUSEL
    // =========================
    const artistCarousel = document.getElementById('artist-carousel');
    if (artistCarousel) {
        artistCarousel.innerHTML = '';

        artists.forEach(artist => {
            const div = document.createElement('div');
            div.className = 'artist-card';

            div.innerHTML = `
                <img src="${artist.image}" 
                     class="artist-image" 
                     loading="lazy" 
                     alt="${artist.name}">
                <div class="artist-name">${artist.name}</div>
                <div class="artist-label">Artist</div>
            `;

            div.addEventListener('click', () => {
                openArtistPage(artist.name);
            });

            artistCarousel.appendChild(div);
        });
    }



    // =========================
    // 🌌 DEEP DIVES
    // =========================
    if (window.Visualizer && typeof window.Visualizer.renderDeepDives === 'function') {
        window.Visualizer.renderDeepDives();
    }
}


// Language Modal Logic
function setupLanguageModal() {
    const btn = document.querySelector('.nav-btn-text'); // The Language Button
    const modal = document.getElementById('language-modal');
    const grid = document.getElementById('language-grid');
    const updateBtn = document.getElementById('update-lang-btn');
    const label = btn.querySelector('span span:nth-child(2)'); // 'Hindi' text

    // Open Modal
    btn.addEventListener('click', () => {
        modal.style.display = 'flex';
        renderLanguageOptions();
    });

    // Close Modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Update Action
    updateBtn.addEventListener('click', () => {
        // Collect selected
        const selectedEls = Array.from(grid.querySelectorAll('.lang-option.selected'));
        selectedLanguages = selectedEls.map(el => el.dataset.lang);

        // Update Label
        if (selectedLanguages.length > 0) {
            label.innerText = selectedLanguages.join(', ').substring(0, 20) + (selectedLanguages.join(', ').length > 20 ? '...' : '');
        } else {
            label.innerText = 'Select Language';
        }

        // Re-render content
        renderHome();

        modal.style.display = 'none';
    });

    function renderLanguageOptions() {
        grid.innerHTML = '';
        allLanguages.forEach(lang => {
            const div = document.createElement('div');
            div.className = 'lang-option';
            if (selectedLanguages.includes(lang)) div.classList.add('selected');
            div.dataset.lang = lang;
            div.innerHTML = `
                <span>${lang}</span>
                <i class="fa-solid fa-circle-check check"></i>
            `;
            div.addEventListener('click', () => {
                div.classList.toggle('selected');
            });
            grid.appendChild(div);
        });
    }
}

function showLibrary(filter) {
    showView('dashboard');
    currentView = 'dashboard';
    const grid = document.getElementById('library-grid');
    const title = document.getElementById('dashboard-title');
    grid.innerHTML = '';

    if (filter === 'artists') {
        const titleText = title.querySelector('span') || title;
        if (title.tagName === 'DIV') { // If it's our new structure
            title.querySelector('span').innerText = 'Artists';
            title.querySelector('i').style.display = 'none';
            title.onclick = null; // Remove sorting click
        } else {
            title.innerText = 'Artists';
        }

        artists.forEach(artist => {
            const card = createCard(artist.name, 'Artist', artist.image, () => {
                console.log('Clicked artist', artist.name);
            }, artist, 'artist');
            grid.appendChild(card);
        });
    } else if (filter === 'albums') {
        const titleText = title.querySelector('span') || title;
        if (title.tagName === 'DIV') {
            title.querySelector('span').innerText = 'Albums';
            title.querySelector('i').style.display = 'none';
            title.onclick = null;
        } else {
            title.innerText = 'Albums';
        }

        albums.forEach(album => {
            const card = createCard(album.title, album.artist, album.cover, () => openAlbum(album), album, 'album');
            grid.appendChild(card);
        });
    } else {
        // "Recently Added" View
        const titleText = title.querySelector('span');
        const icon = title.querySelector('i');

        // Use current sort mapping for title
        const sortLabels = {
            'recent': 'Recently Added',
            'title': 'Title',
            'date': 'Release Date',
            'creator': 'Creator'
        };

        if (titleText) titleText.innerText = sortLabels[currentSort] || 'Recently Added';
        if (icon) icon.style.display = 'block'; // Show dropdown arrow

        // Setup Headers click to toggle menu
        title.onclick = (e) => {
            e.stopPropagation();
            const menu = document.getElementById('sort-menu');
            if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        };

        if (library.length === 0) {
            grid.innerHTML = '<div style="color:#888; grid-column: 1/-1; text-align:center; padding-top:50px;">Your library is empty. Add albums from the "Albums" tab.</div>';
        } else {
            // Filter albums AND deep dive content
            const allContent = [...albums, ...(typeof deepDiveContent !== 'undefined' ? deepDiveContent : [])];
            let libItems = allContent.filter(item => library.includes(item.id));

            // Sort Logic (Basic title sort for mixed content or just reverse added order)
            // Note: sort by 'date', 'creator' might fail if fields missing in deepDiveContent.
            // Default to reverse library order (Recently Added) is safest.

            if (currentSort === 'title') {
                libItems.sort((a, b) => a.title.localeCompare(b.title));
            } else if (currentSort === 'creator') {
                libItems.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
            } else {
                // Recent
                libItems.sort((a, b) => library.lastIndexOf(b.id) - library.lastIndexOf(a.id));
            }

            libItems.forEach(item => {
                // Determine click handler based on type
                let clickHandler;
                if (item.type === 'Album') {
                    clickHandler = () => openAlbum(item);
                } else if (item.type === 'Deep Dive' || item.type === 'Visual Album' || item.type === 'Live Set' || item.type === 'Documentary') {
                    clickHandler = () => openDeepDivePage(item);
                } else {
                    clickHandler = () => openAlbum(item); // Fallback
                }

                // Cover fallback
                let cover = item.cover;
                if (!cover && item.video) cover = "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop"; // Placeholder for video types

                // Pass item and 'album' type to enable context menu (which handles library toggle)
                const card = createCard(item.title, item.artist, cover, clickHandler, item, 'album');
                grid.appendChild(card);
            });
        }
    }
}

let currentSort = 'recent';

function setupSortDropdown() {
    const menu = document.getElementById('sort-menu');
    document.querySelectorAll('.sort-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            // Update Active State
            document.querySelectorAll('.sort-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');

            currentSort = opt.dataset.sort;

            // Hide Menu
            menu.style.display = 'none';

            // Re-render
            showLibrary('recent');
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (menu && menu.style.display === 'block' && !e.target.closest('#dashboard-title')) {
            menu.style.display = 'none';
        }
    });
}

function renderPlaylists() {
    const playlistContainer = document.getElementById('playlist-submenu');
    playlistContainer.innerHTML = '';
    playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'submenu-item';
        div.innerText = pl.name;
        div.addEventListener('click', () => {
            // Show Playlist View (Reuse Album view or similar?)
            // For now, simple log
            console.log('Open ' + pl.name);
        });
        playlistContainer.appendChild(div);
    });
}

// Album Detail Logic
// Album Detail Logic
function openAlbum(album) {
    showView('album');
    // document.getElementById('album-title').innerText = album.title; // overwritten below

    // Header Logic
    const artObj = artists.find(a => a.name === album.artist);
    const artistImg = artObj ? artObj.image : 'https://raw.githubusercontent.com/Legend123-byte/Assests/main/Poster/I1.jpg';

    const metaContainer = document.querySelector('#album-view .album-info-hero');
    if (metaContainer) {
        metaContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:flex-end; height:100%;">
                <h5 style="color: var(--primary-color); letter-spacing: 2px; font-weight:bold; margin-bottom:10px;">${(album.type || 'ALBUM').toUpperCase()}</h5>
                <h1 style="font-size: 64px; margin: 0 0 20px 0; line-height:1;">${album.title}</h1>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <img src="${artistImg}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
                    <span style="font-weight: bold;">${album.artist}</span>
                    <span style="color: #ccc;">• ${album.year || '2024'} • ${album.songs ? album.songs.length : 0} songs</span>
                </div>

                <div class="action-bar" style="display: flex; align-items: center; gap: 24px;">
                    <button id="ab-play-btn" class="action-btn-play" 
                        style="width: 56px; height: 56px; border-radius: 50%; background: #1db954; color: black; border: none; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s;">
                        <i class="fa-solid fa-play"></i>
                    </button>

                    <button id="ab-enhance-btn" title="Enhance"
                        style="background: none; border: 1px solid #727272; color: #fff; border-radius: 20px; padding: 5px 15px; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 5px; height: 32px; transition: all 0.2s;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>

                    <button id="ab-shuffle-btn" title="Shuffle"
                        style="background: none; border: none; color: ${isShuffleOn ? 'var(--primary-color)' : '#b3b3b3'}; font-size: 24px; cursor: pointer; transition: color 0.2s;">
                        <i class="fa-solid fa-shuffle"></i>
                    </button>

                    <button id="ab-add-btn" title="Add to Library"
                        style="background: none; border: 2px solid ${library.includes(album.id) ? 'var(--primary-color)' : '#b3b3b3'}; color: ${library.includes(album.id) ? 'var(--primary-color)' : '#b3b3b3'}; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                        <i class="fa-solid ${library.includes(album.id) ? 'fa-check' : 'fa-plus'}"></i>
                    </button>

                    <button id="ab-download-btn" title="Download"
                        style="background: none; border: 2px solid #b3b3b3; color: #b3b3b3; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                        <i class="fa-solid fa-arrow-down"></i>
                    </button>
                    
                    <button style="background: none; border: none; color: #b3b3b3; font-size: 24px; cursor: pointer;"><i class="fa-solid fa-ellipsis"></i></button>
                </div>
            </div>
        `;
    }

    document.getElementById('album-cover').src = album.cover;

    const tracklist = document.getElementById('tracklist-container');
    tracklist.innerHTML = '';

    // Data Resolution
    let displaySongs = [];
    if (album.songs && album.songs.length > 0) {
        displaySongs = album.songs.map(id => songs.find(s => s.id === id)).filter(s => s);
    } else {
        displaySongs = songs.filter(s => s.album === album.title);
    }

    // === Button Listeners ===
    const playBtn = document.getElementById('ab-play-btn');
    if (playBtn) playBtn.onclick = () => {
        if (displaySongs.length > 0) {
            currentPlaylist = displaySongs;
            currentSongIndex = 0;
            playSong(displaySongs[0]);
        }
    };

    // Add Button
    const addBtn = document.getElementById('ab-add-btn');
    if (addBtn) addBtn.onclick = () => {
        const index = library.indexOf(album.id);
        if (index > -1) {
            library.splice(index, 1);
            addBtn.style.color = '#b3b3b3';
            addBtn.style.borderColor = '#b3b3b3';
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        } else {
            library.push(album.id);
            addBtn.style.color = 'var(--primary-color)';
            addBtn.style.borderColor = 'var(--primary-color)';
            addBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        }
        localStorage.setItem('neonLibrary', JSON.stringify(library));
    };

    displaySongs.forEach((song, index) => {
        const row = document.createElement('div');
        row.className = 'track-item';

        // Highlight active song
        if (String(song.id) === audio.dataset.currentSongId) {
            row.classList.add('active');
        }


        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:20px; flex: 1;">
                <span class="track-number" style="color:#aaa; width:20px;">${index + 1}</span>
                <img src="${song.cover}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
                <div>
                   <div style="color:white; font-size:16px; font-weight:500;">${song.title}</div>
                   <div style="color:#888; font-size:14px;">${song.artist}</div>
                </div>
            </div>
            <button class="like-btn ${isLiked(song.id) ? 'liked' : ''}" data-id="${song.id}" style="background:none; border:none; color:${isLiked(song.id) ? '#1db954' : '#b3b3b3'}; cursor:pointer; margin-right: 20px; font-size: 16px;">
                ${isLiked(song.id) ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>'}
            </button>
            <span style="color:#888; font-size:14px;">${song.duration}</span>
        `;

        // Add listeners
        const likeBtn = row.querySelector('.like-btn');
        likeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLike(song);
            const liked = isLiked(song.id);
            likeBtn.innerHTML = liked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
            likeBtn.style.color = liked ? '#1db954' : '#b3b3b3';
            if (liked) likeBtn.classList.add('liked'); else likeBtn.classList.remove('liked');
        });

        row.addEventListener('click', (e) => {
            if (e.target.closest('.like-btn')) return;
            currentPlaylist = displaySongs;
            currentSongIndex = index;
            playSong(song);
        });
        tracklist.appendChild(row);
    });
}

function openDeepDivePage(data) {
    showView('album'); // Reuse album view container

    // Custom Header for Deep Dive
    const metaContainer = document.querySelector('#album-view .album-info-hero');

    // Resolve Songs first so it is available for header and tracklist
    let displaySongs = [];
    if (data.songs && data.songs.length > 0) {
        displaySongs = data.songs.map(id => songs.find(s => s.id === id)).filter(s => s);
    }

    if (metaContainer) {
        metaContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:flex-end; height:100%;">
                <h5 style="color: var(--primary-color); letter-spacing: 2px; font-weight:bold; margin-bottom:10px;">${data.type.toUpperCase()}</h5>
                <h1 style="font-size: 64px; margin: 0 0 20px 0; line-height:1;">${data.title}</h1>
                <p style="color: #ccc; font-size: 16px; margin-bottom: 20px;">${data.desc}</p>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <img src="https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
                    <span style="font-weight: bold;">${data.artist}</span>
                    <span style="color: #ccc;">• ${data.songs ? data.songs.length : 0} songs</span>
                </div>
                
                <div class="action-bar" style="display: flex; align-items: center; gap: 24px;">
                    <button id="dd-play-btn" class="action-btn-play" 
                        style="width: 56px; height: 56px; border-radius: 50%; background: #1db954; color: black; border: none; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s;">
                        <i class="fa-solid fa-play"></i>
                    </button>

                    <button id="dd-enhance-btn" title="Enhance"
                        style="background: none; border: 1px solid #727272; color: #fff; border-radius: 20px; padding: 5px 15px; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 5px; height: 32px; transition: all 0.2s;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>

                    <button id="dd-shuffle-btn" title="Shuffle"
                        style="background: none; border: none; color: ${isShuffleOn ? 'var(--primary-color)' : '#b3b3b3'}; font-size: 24px; cursor: pointer; transition: color 0.2s;">
                        <i class="fa-solid fa-shuffle"></i>
                    </button>

                    <button id="dd-add-btn" title="Add to Library"
                        style="background: none; border: 2px solid ${library.includes(data.id) ? 'var(--primary-color)' : '#b3b3b3'}; color: ${library.includes(data.id) ? 'var(--primary-color)' : '#b3b3b3'}; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                        <i class="fa-solid ${library.includes(data.id) ? 'fa-check' : 'fa-plus'}"></i>
                    </button>

                    <button id="dd-download-btn" title="Download"
                        style="background: none; border: 2px solid #b3b3b3; color: #b3b3b3; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                        <i class="fa-solid fa-arrow-down"></i>
                    </button>
                    
                    <button style="background: none; border: none; color: #b3b3b3; font-size: 24px; cursor: pointer;"><i class="fa-solid fa-ellipsis"></i></button>
                </div>
            </div>
        `;

        // === Button Logic ===

        // Play Button
        const playBtn = document.getElementById('dd-play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (displaySongs.length > 0) {
                    currentPlaylist = displaySongs;
                    currentSongIndex = 0;
                    playSong(displaySongs[0]); // Plays first song
                }
            });
        }

        // Shuffle Button
        const shuffleBtn = document.getElementById('dd-shuffle-btn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                isShuffleOn = !isShuffleOn;
                shuffleBtn.style.color = isShuffleOn ? 'var(--primary-color)' : '#b3b3b3';
                // Also update global shuffle button state if visible elsewhere
                const mainShuffle = document.getElementById('shuffle-btn');
                if (mainShuffle) {
                    mainShuffle.classList.toggle('active', isShuffleOn);
                    mainShuffle.style.color = isShuffleOn ? 'var(--primary-color)' : '#b3b3b3';
                }
            });
        }

        // Add Button
        const addBtn = document.getElementById('dd-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const index = library.indexOf(data.id);
                if (index > -1) {
                    library.splice(index, 1); // Remove
                    addBtn.style.color = '#b3b3b3';
                    addBtn.style.borderColor = '#b3b3b3';
                    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
                } else {
                    library.push(data.id); // Add
                    addBtn.style.color = 'var(--primary-color)';
                    addBtn.style.borderColor = 'var(--primary-color)';
                    addBtn.innerHTML = '<i class="fa-solid fa-check"></i>';

                    // Optional: If user is viewing library, refresh it? 
                    // Not needed right now as we are in Album view.
                }
                localStorage.setItem('neonLibrary', JSON.stringify(library));
            });
        }

        // Download Button
        const dlBtn = document.getElementById('dd-download-btn');
        if (dlBtn) {
            dlBtn.addEventListener('click', () => {
                if (dlBtn.innerHTML.includes('fa-check')) return; // Already downloaded

                const originalIcon = dlBtn.innerHTML;
                dlBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                dlBtn.style.color = 'var(--primary-color)';
                dlBtn.style.borderColor = 'var(--primary-color)';

                setTimeout(() => {
                    dlBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                    // Reset after 2s or keep checked? User implies persistent state or just visual feedback.
                    // "When downloaded" usually implies persistent. Let's keep it checked for session.
                }, 1500);
            });
        }
    }

    // Set Cover (Video thumbnail or placeholder)
    document.getElementById('album-cover').src = "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop";

    const tracklist = document.getElementById('tracklist-container');
    tracklist.innerHTML = '';

    // Song list already resolved above for play button

    if (displaySongs.length === 0) {
        tracklist.innerHTML = '<div style="padding: 20px; color: #888;">No tracks available for this section.</div>';
        return;
    }

    displaySongs.forEach((song, index) => {
        const row = document.createElement('div');
        row.className = 'track-item';
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:20px; flex: 1;">
                <span class="track-number" style="color:#aaa; width:20px;">${index + 1}</span>
                <img src="${song.cover}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
                <div>
                   <div style="color:white; font-size:16px; font-weight:500;">${song.title}</div>
                   <div style="color:#888; font-size:14px;">${song.artist}</div>
                </div>
            </div>
            <button class="like-btn ${isLiked(song.id) ? 'liked' : ''}" data-id="${song.id}" style="background:none; border:none; color:${isLiked(song.id) ? '#1db954' : '#b3b3b3'}; cursor:pointer; margin-right: 20px; font-size: 16px;">
                ${isLiked(song.id) ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>'}
            </button>
            <span style="color:#888; font-size:14px;">${song.duration}</span>
        `;

        // Listeners
        const likeBtn = row.querySelector('.like-btn');
        likeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLike(song);

            const liked = isLiked(song.id);
            // Update color and icon
            likeBtn.innerHTML = liked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
            likeBtn.style.color = liked ? '#1db954' : '#b3b3b3';
            // Update class for visibility
            if (liked) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
        });

        row.addEventListener('click', (e) => {
            if (e.target.closest('.like-btn')) return;
            currentPlaylist = displaySongs;
            currentSongIndex = index;
            playSong(song);
        });
        tracklist.appendChild(row);
    });
}

// Playback Logic
function playSong(song) {
    // Check if song is in current playlist, if not, make a single song playlist
    // For simplicity, we just play it.

    audio.src = song.src;
    audio.dataset.currentSongId = song.id;
    audio.play().catch(error => {
        console.error("Playback failed:", error);
    });
    isPlaying = true;
    updatePlayerUI(song);
    updatePlayButton();
    savePlayerState();

    // Auto-open sidebar
    const sidebar = document.getElementById('right-sidebar');
    if (sidebar && sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
    }

    // Set Visualizer Mode
    if (typeof Visualizer !== 'undefined') {
        Visualizer.setMode(song.genre);
    } else if (window.Visualizer) {
        window.Visualizer.setMode(song.genre);
    }
}

function togglePlay() {
    if (!audio.src) return;
    if (audio.paused) {
        audio.play();
        isPlaying = true;
    } else {
        audio.pause();
        isPlaying = false;
    }
    updatePlayButton();
}

function updatePlayButton() {
    if (isPlaying) {
        if (player.playBtn) player.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        if (player.video) player.video.play().catch(e => console.log('Video play error', e));

        const rsVideo = document.getElementById('rs-loop-video');
        if (rsVideo) rsVideo.play().catch(e => console.error(e));
    } else {
        if (player.playBtn) player.playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (player.video) player.video.pause();

        const rsVideo = document.getElementById('rs-loop-video');
        if (rsVideo) rsVideo.pause();
    }
}

// Update Player and Right Side Canvas
// Update Player and Right Side Canvas
// Update Player and Right Side Canvas
function updatePlayerUI(song) {
    if (player.title) player.title.innerText = song.title;
    if (player.artist) player.artist.innerText = song.artist;

    // Right Side Canvas Updates
    const rsVideo = document.getElementById('rs-loop-video');
    const rsTitle = document.getElementById('rs-title');
    const rsArtist = document.getElementById('rs-artist');
    const rsAboutImg = document.getElementById('rs-about-img');
    const rsListeners = document.getElementById('rs-listeners');
    const rsBio = document.getElementById('rs-bio');
    const rsCredits = document.getElementById('rs-credits-list');

    // Mini Player Updates
    const miniCover = document.getElementById('mini-cover');
    const miniTitle = document.querySelector('.mini-title');
    const miniArtist = document.querySelector('.mini-artist');
    const miniInfo = document.querySelector('.mini-info');
    const miniAddBtn = document.getElementById('mini-add-btn');

    // Ensure elements exist before trying to update
    if (miniCover && song.cover) {
        miniCover.src = song.cover;
        miniCover.style.opacity = '1';
        miniCover.style.display = 'block';
    }

    if (miniTitle && miniInfo) {
        miniTitle.innerText = song.title;
        miniInfo.style.opacity = '1';
        miniInfo.style.display = 'flex';
    }

    if (miniArtist) {
        miniArtist.innerText = song.artist || 'Unknown Artist';
        miniArtist.classList.add('artist-link'); // Add link class
        miniArtist.style.cursor = 'pointer';
        miniArtist.style.textDecoration = 'underline'; // Optional visual cue
        miniArtist.onclick = (e) => {
            e.stopPropagation();
            openArtistPage(song.artist);
        }
    }

    // Add to library button (Simple toggle for now)
    if (miniAddBtn) {
        miniAddBtn.onclick = (e) => {
            e.stopPropagation();
            miniAddBtn.classList.toggle('added');
            const icon = miniAddBtn.querySelector('i');
            if (icon) {
                if (miniAddBtn.classList.contains('added')) {
                    icon.classList.remove('fa-regular');
                    icon.classList.add('fa-solid');
                    icon.style.color = 'var(--primary-color)';
                } else {
                    icon.classList.remove('fa-solid');
                    icon.classList.add('fa-regular');
                    icon.style.color = '#b3b3b3';
                }
            }
        };
    }

    // About Section & Right Sidebar
    if (rsVideo && song.video) {
        rsVideo.src = song.video;
        rsVideo.play().catch(e => console.log('Autoplay prevented'));
    }
    if (rsTitle) rsTitle.innerText = song.title;
    if (rsArtist) rsArtist.innerText = song.artist;

    // Find rich artist data
    const artistData = artists.find(a => a.name === song.artist);
    if (artistData) {
        if (rsAboutImg) rsAboutImg.src = artistData.aboutImage || artistData.image;
        if (rsListeners) rsListeners.innerText = `${artistData.listeners || '10,000'} monthly listeners`;
        if (rsBio) rsBio.innerText = artistData.bio || 'Artist bio not available.';

        // Mock credits based on artist
        if (rsCredits) {
            rsCredits.innerHTML = `
                    <div class="rs-credit-item">
                        <div>
                            <div class="rs-credit-role">${artistData.name}</div>
                            <div class="rs-credit-name">Main Artist</div>
                        </div>
                        <button class="rs-follow-btn">Follow</button>
                    </div>
                    <div class="rs-credit-item">
                        <div>
                            <div class="rs-credit-role">Neon Producer</div>
                            <div class="rs-credit-name">Producer</div>
                        </div>
                        <button class="rs-follow-btn">Follow</button>
                    </div>
                    <div class="rs-credit-item">
                        <div>
                            <div class="rs-credit-role">Retro Writer</div>
                            <div class="rs-credit-name">Composer</div>
                        </div>
                    </div>
                `;
        }
    }
}

function updateProgress() {
    const { currentTime, duration } = audio;
    const progressPercent = (currentTime / duration) * 100;
    player.progressFill.style.width = `${progressPercent}%`;
    player.currTime.innerText = formatTime(currentTime);

    if (typeof updateMiniPlayerProgress === 'function') {
        updateMiniPlayerProgress(currentTime, duration);
    }
}

function formatTime(time) {
    if (isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

// Playback Logic helpers
let isShuffleOn = false;

function playNext() {
    // If we have a playlist context
    if (currentPlaylist.length > 0) {
        if (isShuffleOn) {
            // Pick random index
            let newIndex = Math.floor(Math.random() * currentPlaylist.length);
            // Optional: avoid playing strictly the same song if list > 1
            if (currentPlaylist.length > 1 && newIndex === currentSongIndex) {
                newIndex = (newIndex + 1) % currentPlaylist.length;
            }
            currentSongIndex = newIndex;
        } else {
            currentSongIndex = (currentSongIndex + 1) % currentPlaylist.length;
        }
        playSong(currentPlaylist[currentSongIndex]);
    }
}

function playPrev() {
    if (currentPlaylist.length > 0) {
        currentSongIndex = (currentSongIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        playSong(currentPlaylist[currentSongIndex]);
    }
}

// Search Logic
function handleSearch(query) {
    showView('search');
    const grid = document.getElementById('search-results-grid');
    grid.innerHTML = '';

    const results = songs.filter(s => s.title.toLowerCase().includes(query) || s.artist.toLowerCase().includes(query));

    if (results.length === 0) {
        grid.innerHTML = '<div style="color:#888; padding:20px;">No results found</div>';
        return;
    }

    results.forEach(song => {
        const card = createCard(song.title, song.artist, song.cover, () => playSong(song));
        grid.appendChild(card);
    });
}

// === Context Menu Logic ===
document.addEventListener('click', (e) => {
    const menu = document.getElementById('context-menu');
    if (menu && !menu.contains(e.target)) {
        menu.style.display = 'none';
        menu.classList.remove('active');
    }
});

function toggleLibrary(id) {
    const index = library.indexOf(id);
    if (index > -1) {
        library.splice(index, 1);
    } else {
        library.push(id);
    }
    localStorage.setItem('neonLibrary', JSON.stringify(library));
    // Refresh if in library view
    if (document.getElementById('dashboard-title').innerText === 'Recently Added' && currentView === 'dashboard') {
        showLibrary('recent');
    }
}

function showContextMenu(e, item, type) {
    if (type !== 'album') return; // Only albums for now
    e.stopPropagation();
    e.preventDefault();

    const existing = document.getElementById('context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'context-menu active';

    const isInLib = library.includes(item.id);
    const libAction = isInLib ? 'Remove from Library' : 'Add to Library';
    const libIcon = isInLib ? 'fa-minus' : 'fa-plus';

    menu.innerHTML = `
        <div class="context-menu-item" id="ctx-lib">
            <i class="fa-solid ${libIcon}"></i> ${libAction}
        </div>
        <div class="context-menu-item" id="ctx-pl">
            <i class="fa-solid fa-list"></i> Add to Playlist
        </div>
    `;

    document.body.appendChild(menu);
    const x = e.pageX;
    const y = e.pageY;

    // Boundary check (simple)
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    menu.querySelector('#ctx-lib').addEventListener('click', () => {
        toggleLibrary(item.id);
        menu.remove();
    });

    menu.querySelector('#ctx-pl').addEventListener('click', () => {
        // Trigger playlist dialog (Stub)
        document.getElementById('playlist-dialog').style.display = 'flex';
        menu.remove();
    });
}

// Artist Page Logic
function openArtistPage(artistName) {
    const artist = artists.find(a => a.name === artistName);
    if (!artist) return;

    showView('artist');

    // Update Header
    const hero = document.getElementById('artist-hero');
    const name = document.getElementById('artist-name-large');
    const listeners = document.getElementById('artist-listeners-large');

    hero.style.backgroundImage = `url('${artist.aboutImage || artist.image}')`;
    name.innerText = artist.name;
    listeners.innerText = `${artist.listeners} monthly listeners`;

    // Populate Tracks
    const tracklist = document.getElementById('artist-tracklist');
    tracklist.innerHTML = '';

    const artistSongs = songs.filter(s => s.artist === artist.name);

    // Play Button Logic
    const playButton = document.getElementById('artist-play-btn');
    if (playButton) {
        const newBtn = playButton.cloneNode(true);
        playButton.parentNode.replaceChild(newBtn, playButton);

        newBtn.addEventListener('click', () => {
            if (artistSongs.length > 0) {
                currentPlaylist = artistSongs;
                currentSongIndex = 0;
                playSong(artistSongs[0]);
            }
        });
    }

    // Shuffle Button Logic
    const shuffleBtn = document.getElementById('artist-shuffle-btn');
    if (shuffleBtn) {
        const newShuffle = shuffleBtn.cloneNode(true);
        shuffleBtn.parentNode.replaceChild(newShuffle, shuffleBtn);

        // Init visual state
        newShuffle.style.color = isShuffleOn ? '#1db954' : '#b3b3b3';
        newShuffle.querySelector('i').className = 'fa-solid fa-shuffle';

        newShuffle.addEventListener('click', () => {
            isShuffleOn = !isShuffleOn;
            newShuffle.style.color = isShuffleOn ? '#1db954' : '#b3b3b3';
        });
    }

    // Add to Library Button Logic
    const addBtn = document.getElementById('artist-add-btn');
    if (addBtn) {
        const newAdd = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAdd, addBtn);

        let isAdded = false;

        newAdd.addEventListener('click', () => {
            isAdded = !isAdded;
            const icon = newAdd.querySelector('i');
            if (isAdded) {
                icon.className = 'fa-solid fa-check';
                newAdd.style.color = '#1db954';
                newAdd.style.borderColor = '#1db954';
            } else {
                icon.className = 'fa-solid fa-plus';
                newAdd.style.color = '#b3b3b3';
                newAdd.style.borderColor = '#b3b3b3';
            }
        });
    }

    // Download Button Logic
    const dlBtn = document.getElementById('artist-download-btn');
    if (dlBtn) {
        const newDl = dlBtn.cloneNode(true);
        dlBtn.parentNode.replaceChild(newDl, dlBtn);

        newDl.addEventListener('click', () => {
            if (artistSongs.length === 0) return;

            // Visual feedback
            const originalIcon = newDl.innerHTML;
            newDl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            newDl.style.color = '#1db954';
            newDl.style.borderColor = '#1db954';

            setTimeout(() => {
                newDl.innerHTML = '<i class="fa-solid fa-check"></i>';

                // Reset after 2s
                setTimeout(() => {
                    newDl.innerHTML = originalIcon;
                    newDl.style.color = '#b3b3b3';
                    newDl.style.borderColor = '#b3b3b3';
                }, 2000);
            }, 1500);
        });
    }

    artistSongs.forEach((song, index) => {
        const row = document.createElement('div');
        row.className = 'track-item';
        // Highlight currently playing song
        if (String(song.id) === audio.dataset.currentSongId) {
            row.classList.add('active');
        }

        row.innerHTML = `
            <div style="display:flex; align-items:center; gap: 15px; flex: 1;">
                <div class="track-number" style="color: #b3b3b3; font-size: 16px; width: 20px;">${index + 1}</div>
                <img src="${song.cover}" style="width: 40px; height: 40px; border-radius: 4px;">
                <div style="display: flex; flex-direction: column;">
                    <span style="color: white; font-size: 15px;">${song.title}</span>
                </div>
            </div>
            <button class="like-btn" data-id="${song.id}" style="background:none; border:none; color:${isLiked(song.id) ? '#1db954' : '#b3b3b3'}; cursor:pointer; margin-right: 20px; font-size: 16px;">
                ${isLiked(song.id) ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>'}
            </button>
            <div style="color: #b3b3b3; font-size: 14px; margin-right: 40px;">${song.listeners || '1,000,000'}</div> 
            <div style="color: #b3b3b3; font-size: 14px;">${song.duration}</div>
        `;

        // Add listeners
        const likeBtn = row.querySelector('.like-btn');
        likeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLike(song);
        });

        row.addEventListener('click', (e) => {
            if (e.target.closest('.like-btn')) return;
            currentPlaylist = artistSongs;
            currentSongIndex = index;
            playSong(song);
        });
        tracklist.appendChild(row);
    });
}

// Player Persistence
function savePlayerState() {
    if (!currentPlaylist || currentPlaylist.length === 0) return;

    const state = {
        songId: currentPlaylist[currentSongIndex].id
    };

    localStorage.setItem('neonPlayerState', JSON.stringify(state));
}


function loadPlayerState() {
    const saved = localStorage.getItem('neonPlayerState');
    if (!saved) return;

    try {
        const state = JSON.parse(saved);
        if (!state.songId) return;

        const song = songs.find(s => s.id === state.songId);
        if (!song) return;

        currentPlaylist = songs;
        currentSongIndex = songs.findIndex(s => s.id === song.id);

        audio.src = song.src;
        audio.dataset.currentSongId = song.id;

        updatePlayerUI(song);

        isPlaying = false;
        updatePlayButton();

    } catch (e) {
        console.error('Failed to load player state', e);
    }
}



// Render Liked Songs
// Render Liked Songs (Grouped by Album)
// Render Liked Songs (Flat Track List)
function renderLikedSongs() {
    showView('liked');
    currentView = 'liked';

    const container = document.getElementById('liked-tracklist-container');
    const countEl = document.getElementById('liked-songs-count');
    const playBtn = document.getElementById('play-liked-btn');

    // Show play button for the list
    if (playBtn) {
        playBtn.style.display = 'flex';
        playBtn.onclick = () => {
            if (likedSongs.length > 0) {
                currentPlaylist = likedSongs;
                currentSongIndex = 0;
                playSong(likedSongs[0]);
            }
        };
    }

    if (!container || !countEl) return;

    container.innerHTML = '';

    // Reset container layout to block for list
    container.style.display = 'block';
    container.style.marginTop = '0'; // Reset any grid margins

    countEl.innerText = `${likedSongs.length} songs`;

    if (likedSongs.length === 0) {
        container.innerHTML = '<div style="color:#888; text-align:center; padding: 40px;">You haven\'t liked any songs yet. Tap the heart icon on any track!</div>';
        return;
    }

    likedSongs.forEach((song, index) => {
        const row = document.createElement('div');
        row.className = 'track-item';
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:20px; flex: 1;">
                <span class="track-number" style="color:#aaa; width:20px;">${index + 1}</span>
                <img src="${song.cover}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
                <div>
                   <div style="color:white; font-size:16px; font-weight:500;">${song.title}</div>
                   <div style="color:#888; font-size:14px;">${song.artist}</div>
                </div>
            </div>
            
            <div style="display:flex; align-items:center;">
                <span style="color:#888; font-size:14px; margin-right: 20px;">${song.album || 'Single'}</span>
                
                <button class="like-btn liked" data-id="${song.id}" style="background:none; border:none; color:#1db954; cursor:pointer; margin-right: 20px; font-size: 16px;">
                    <i class="fa-solid fa-heart"></i>
                </button>
                
                <span style="color:#888; font-size:14px; width: 40px; text-align: right;">${song.duration}</span>
                <button class="track-menu-btn" style="background:none; border:none; color:#b3b3b3; cursor:pointer; margin-left: 10px;"><i class="fa-solid fa-ellipsis"></i></button>
            </div>
        `;

        // Add listeners
        const likeBtn = row.querySelector('.like-btn');
        likeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLike(song);
            renderLikedSongs(); // Re-render to remove
        });

        row.addEventListener('click', (e) => {
            if (e.target.closest('.like-btn') || e.target.closest('.track-menu-btn')) return;
            currentPlaylist = likedSongs;
            currentSongIndex = index;
            playSong(song);
        });

        container.appendChild(row);
    });
}


// Global click handler for artist names
document.addEventListener('click', (e) => {
    // Check if clicked element is an artist name/link
    if (e.target.closest('.artist-link') || e.target.classList.contains('artist-link')) {
        const link = e.target.closest('.artist-link') || e.target;
        const name = link.innerText;
        openArtistPage(name);
    }
});

// Save state events
window.addEventListener('beforeunload', savePlayerState);
audio.addEventListener('pause', savePlayerState);

// Throttle save during playback (every 2s)
let lastSave = 0;
audio.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastSave > 2000) {
        savePlayerState();
        lastSave = now;
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) savePlayerState();
});

// Start
// Visualizer Module
const Visualizer = {
    canvas: document.getElementById('bg-visualizer'),
    ctx: null,
    audioContext: null,
    source: null,
    analyser: null,
    dataArray: null,
    animationId: null,
    mode: 'EDM',

    // Galaxy Theme Backgrounds (Cloud Source)
    bgImages: {
        'EDM': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop', // Deep Earth/Space
        'Lo-fi': 'https://images.unsplash.com/photo-1614730341194-75c60740a2d3?q=80&w=1974&auto=format&fit=crop', // Purple Planet
        'Classical': 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2011&auto=format&fit=crop', // Milky Way Stars
        'Rock': 'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=2070&auto=format&fit=crop', // Neon Burst
        'Happy': 'https://images.unsplash.com/photo-1533292686609-dd188d11dd49?q=80&w=2071&auto=format&fit=crop' // Golden Lights
    },
    loadedImages: {},

    init() {
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Preload Images
        Object.keys(this.bgImages).forEach(key => {
            const img = new Image();
            img.src = this.bgImages[key];
            this.loadedImages[key] = img;
        });

        // Initial black screen
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render Deep Dives Section
        this.renderDeepDives();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    setupAudio() {
        if (this.audioContext) {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            return;
        }

        // Create context on user gesture
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            // Connect existing audio element
            // Handle CORS issues gracefully
            try {
                // IMPORTANT: Connecting the audio element to Web Audio API "hijacks" the output.
                // If CORS prevents reading data, the output is silent.
                // We are disabling this connection to ensure the user hears music, even if Visualizer is generic.

                // this.source = this.audioContext.createMediaElementSource(audio);
                // this.source.connect(this.analyser);
                // this.analyser.connect(this.audioContext.destination);

                console.log('Web Audio API hook disabled to ensure playback stability.');
            } catch (mediaError) {
                console.warn('CORS or MediaSource error. Visualizer will run in fallback mode.', mediaError);
            }

            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            console.log('AudioContext initialized');
            this.animate();
        } catch (e) {
            console.error('AudioContext setup failed:', e);
        }
    },

    setMode(genre) {
        this.mode = genre || 'EDM';
        console.log('Visualizer mode:', this.mode);
        this.particles = [];

        if (this.mode === 'Classical') {
            for (let i = 0; i < 100; i++) {
                this.particles.push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    size: Math.random() * 2,
                    speed: Math.random() * 0.5
                });
            }
        } else if (this.mode === 'Lo-fi') {
            for (let i = 0; i < 50; i++) {
                this.particles.push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    len: Math.random() * 20 + 10,
                    speed: Math.random() * 5 + 5
                });
            }
        }
    },

    getBass() {
        if (!this.analyser) {
            // Fallback simulation: Pulse with time
            return 128 + Math.sin(Date.now() / 200) * 50;
        }
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < 10; i++) sum += this.dataArray[i];

        // If silence (CORS issue), return simulation
        let val = sum / 10;
        if (val === 0) return 128 + Math.sin(Date.now() / 200) * 50;
        return val;
    },

    getTreble() {
        if (!this.analyser) {
            // Fallback simulation
            return 100 + Math.cos(Date.now() / 150) * 30;
        }
        let sum = 0;
        const start = Math.floor(this.analyser.frequencyBinCount * 0.7);
        for (let i = start; i < this.analyser.frequencyBinCount; i++) sum += this.dataArray[i];

        // If silence, return simulation
        let val = sum / (this.analyser.frequencyBinCount - start);
        if (val === 0) return 100 + Math.cos(Date.now() / 150) * 30;
        return val;
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        if (!this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const bass = this.getBass();
        const treble = this.getTreble();

        // Draw Background Image
        const img = this.loadedImages[this.mode] || this.loadedImages['EDM'];
        if (img) {
            // Static "Cover" fit
            const imgAspect = img.width / img.height;
            const canvasAspect = w / h;

            let dw, dh, dx, dy;
            if (canvasAspect > imgAspect) {
                dw = w;
                dh = w / imgAspect;
            } else {
                dh = h;
                dw = h * imgAspect;
            }
            dx = (w - dw) / 2;
            dy = (h - dh) / 2;

            this.ctx.save();
            this.ctx.globalAlpha = 0.4;
            try {
                this.ctx.drawImage(img, dx, dy, dw, dh);
            } catch (e) { }
            this.ctx.restore();
        } else {
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(0, 0, w, h);
        }

        // Gradient Overlay (Darker for text contrast)
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(0,0,0,0.3)');
        grad.addColorStop(1, 'rgba(0,0,0,0.8)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        // Only draw particles/overlays, NO heavy geometry
        if (this.mode === 'EDM') {
            this.drawCyberpunk(w, h, bass, treble);
        } else if (this.mode === 'Lo-fi') {
            this.drawLofi(w, h, bass);
        } else if (this.mode === 'Classical') {
            this.drawGalaxy(w, h, bass, treble);
        } else if (this.mode === 'Rock') {
            this.drawRock(w, h, bass);
        } else {
            this.drawDefault(w, h, bass);
        }
    },

    drawDefault(w, h, bass) {
        this.ctx.fillStyle = `rgb(10, 10, 15)`;
        this.ctx.fillRect(0, 0, w, h);

        const radius = 50 + bass;
        this.ctx.beginPath();
        this.ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `hsl(${bass}, 100%, 50%)`;
        this.ctx.lineWidth = 5;
        this.ctx.stroke();
    },
    // Render Deep Dives (Video Panels)
    renderDeepDives() {
        if (!deepDiveContent || deepDiveContent.length === 0) return;

        const container = document.getElementById('big-panels-grid');
        if (container) {
            container.className = 'deep-dive-grid';
            container.innerHTML = '';

            let currentPreviewAudio = null;
            let currentPreviewVideo = null;
            let currentPreviewBtn = null;
            let currentPreviewInterval = null;

            const stopPreview = () => {
                if (currentPreviewAudio) {
                    currentPreviewAudio.pause();
                    currentPreviewAudio = null;
                }
                if (currentPreviewVideo) {
                    currentPreviewVideo.pause();
                    currentPreviewVideo.currentTime = 0;
                    currentPreviewVideo.style.opacity = '0.6';
                    currentPreviewVideo = null;
                }
                if (currentPreviewInterval) {
                    clearInterval(currentPreviewInterval);
                    currentPreviewInterval = null;
                }
                if (currentPreviewBtn) {
                    currentPreviewBtn.classList.remove('active');
                    currentPreviewBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i><span class="btn-text">Preview</span>';
                    currentPreviewBtn = null;
                }
            };

            // Loop 12 items for grid
            for (let i = 0; i < 12; i++) {
                // Determine Content Group for this panel
                // If deepDiveContent has fewer than 12 groups, wrap around
                const groupIndex = i % deepDiveContent.length;
                const groupItems = deepDiveContent[groupIndex];

                // If group is empty or invalid, skip
                if (!Array.isArray(groupItems) || groupItems.length === 0) continue;

                // Initial item to show (0)
                const initialItem = groupItems[0];

                const panel = document.createElement('div');
                panel.className = 'video-panel';
                panel.dataset.group = groupIndex;
                panel.dataset.current = 0; // Index within the group

                panel.innerHTML = `
                    <div class="panel-video-container">
                        <video class="panel-video" src="${initialItem.video}" loop muted playsinline></video>
                        <div class="panel-overlay">
                            <!-- Preview Button -->
                            <button class="preview-btn">
                                <i class="fa-solid fa-volume-high"></i>
                                <span class="btn-text">Preview</span>
                            </button>

                            <div class="panel-top">
                                <img src="https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=100&h=100&fit=crop" class="panel-mini-cover" style="opacity:0.8">
                                <div class="panel-meta">
                                    <div class="panel-type">${initialItem.type}</div>
                                    <div class="panel-title">${initialItem.title}</div>
                                </div>
                            </div>
                            <!-- Navigation Controls -->
                            <div class="panel-center-controls">
                                <button class="panel-nav config-prev"><i class="fa-solid fa-chevron-left"></i></button>
                                <button class="panel-nav config-next"><i class="fa-solid fa-chevron-right"></i></button>
                            </div>
                            <div class="panel-bottom">
                                <div class="panel-desc">${initialItem.desc}</div>
                                <div class="panel-song-info">
                                    <i class="fa-solid fa-chart-simple"></i>
                                    <span>${initialItem.audio.replace('.mp3', '').replace('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-', 'Track ')}</span>
                                </div>
                                <div class="panel-actions">
                                    <button class="panel-play-btn"><i class="fa-solid fa-play"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                // Elements
                const video = panel.querySelector('video');
                const title = panel.querySelector('.panel-title');
                const type = panel.querySelector('.panel-type');
                const desc = panel.querySelector('.panel-desc');
                const songTitle = panel.querySelector('.panel-song-info span');
                const previewBtn = panel.querySelector('.preview-btn');
                const prevBtn = panel.querySelector('.config-prev');
                const nextBtn = panel.querySelector('.config-next');

                // Helper to get current item data
                const getCurrentItem = () => {
                    const cIdx = parseInt(panel.dataset.current);
                    return groupItems[cIdx];
                };

                // Panel Click -> Open Page
                panel.addEventListener('click', (e) => {
                    if (e.target.closest('.preview-btn') || e.target.closest('.panel-actions') || e.target.closest('.panel-nav')) return;
                    stopPreview();
                    openDeepDivePage(getCurrentItem());
                });

                // Hover Logic
                panel.addEventListener('mouseenter', () => {
                    if (currentPreviewVideo !== video) {
                        video.play().catch(e => { });
                        video.style.opacity = '1';
                    }
                });

                panel.addEventListener('mouseleave', () => {
                    if (currentPreviewVideo !== video) {
                        video.pause();
                        video.currentTime = 0;
                        video.style.opacity = '0.6';
                    }
                    stopPreview(); // Also stop preview on leave
                });

                // Preview Logic
                previewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const item = getCurrentItem();

                    if (currentPreviewBtn === previewBtn) {
                        stopPreview();
                        return;
                    }

                    stopPreview();

                    if (item.audio) {
                        const audio = new Audio(item.audio);
                        audio.volume = 0.5;

                        video.currentTime = 0;
                        video.style.opacity = '1';

                        audio.play().catch(e => console.log(e));
                        video.play().catch(e => console.log(e));

                        currentPreviewAudio = audio;
                        currentPreviewVideo = video;
                        currentPreviewBtn = previewBtn;

                        // 30s Loop Logic
                        currentPreviewInterval = setInterval(() => {
                            if (audio.currentTime >= 30) {
                                audio.currentTime = 0;
                                video.currentTime = 0;
                                audio.play();
                                video.play();
                            }
                        }, 250);

                        previewBtn.classList.add('active');
                        const barsHtml = `
                            <div class="equalizer">
                                <div class="bar"></div>
                                <div class="bar"></div>
                                <div class="bar"></div>
                                <div class="bar"></div>
                            </div>
                        `;

                        // Extract Name
                        let tName = item.audio.replace('.mp3', '').replace('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-', 'Track ');
                        if (item.audio === "On My Way.mp3") tName = "On My Way";

                        previewBtn.innerHTML = `${barsHtml}<span class="btn-text">${tName}</span>`;

                        audio.onended = () => {
                            // Loop logic handles this, but fair fallback
                            audio.currentTime = 0;
                            audio.play();
                        };
                    }
                });

                // Navigation Logic
                const updatePanelUI = (index) => {
                    // Wrap
                    if (index < 0) index = groupItems.length - 1;
                    if (index >= groupItems.length) index = 0;

                    stopPreview();
                    panel.dataset.current = index;
                    const item = groupItems[index];

                    // Update DOM
                    title.innerText = item.title;
                    type.innerText = item.type;
                    desc.innerText = item.desc;
                    songTitle.innerText = item.audio.replace('.mp3', '').replace('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-', 'Track ');
                    video.src = item.video; // Change video if different

                    if (panel.matches(':hover')) {
                        video.play().catch(e => { });
                    }
                };

                prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    updatePanelUI(parseInt(panel.dataset.current) - 1);
                });

                nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    updatePanelUI(parseInt(panel.dataset.current) + 1);
                });

                container.appendChild(panel);
            }
        }
    },
    drawCyberpunk(w, h, bass, treble) {
        // Just the pulses/particles, NO GRID (cleaner look)
        // Add some random neon sparks
        if (Math.random() > 0.9) {
            this.ctx.fillStyle = `rgba(0, 255, 255, ${Math.random()})`;
            this.ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
    },

    drawLofi(w, h, bass) {
        // Transparent BG
        // this.ctx.fillStyle = 'rgba(10, 15, 30, 0.3)';
        // this.ctx.fillRect(0, 0, w, h);

        this.ctx.strokeStyle = 'rgba(200, 200, 255, 0.6)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        if (this.particles) {
            this.particles.forEach(p => {
                p.y += p.speed;
                if (p.y > h) p.y = 0;
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(p.x, p.y + p.len);
            });
        }
        this.ctx.stroke();
        const light = 100 + bass / 2;
        this.ctx.fillStyle = `rgba(255, 200, 150, ${0.05 + bass / 800})`;
        this.ctx.beginPath();
        this.ctx.arc(w / 2, h / 2, light * 3, 0, Math.PI * 2);
        this.ctx.fill();
    },

    drawGalaxy(w, h, bass, treble) {
        // Transparent BG
        // this.ctx.fillStyle = 'rgba(5, 5, 20, 0.2)';
        // this.ctx.fillRect(0, 0, w, h);

        this.ctx.fillStyle = 'white';
        if (this.particles) {
            this.particles.forEach(p => {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.globalAlpha = Math.random() * (0.5 + treble / 255);
                this.ctx.fill();
            });
        }
        this.ctx.globalAlpha = 1;
        this.ctx.beginPath();
        this.ctx.arc(w / 2, h / 2, 100 + bass / 5, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(50, 0, 100, 0.1)`;
        this.ctx.strokeStyle = `rgba(100, 50, 255, ${bass / 255})`;
        this.ctx.lineWidth = 2;
        this.ctx.fill();
        this.ctx.stroke();
        if (treble > 150 && Math.random() > 0.9) {
            this.ctx.beginPath();
            const sx = Math.random() * w;
            const sy = Math.random() * h;
            this.ctx.moveTo(sx, sy);
            this.ctx.lineTo(sx + 100, sy + 100);
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }
    },

    drawRock(w, h, bass) {
        // Just the camera shake effect handles the "Rock" vibe
        // No extra geometry needed on top of the intense background
        if (bass > 200) {
            const shake = (Math.random() - 0.5) * 10;
            this.ctx.save();
            this.ctx.translate(shake, shake);
            this.ctx.restore();
        }
    }
};

// Make Visualizer global
window.Visualizer = Visualizer;

// Hook into init
const originalInit = init;
init = function () {
    originalInit();
    if (window.Visualizer) window.Visualizer.init();

    try {
        if (
            typeof updatePlayerUI === 'function' &&
            typeof songs !== 'undefined' &&
            songs.length > 0 &&
            !audio.dataset.currentSongId   // 👈 important condition
        ) {
            updatePlayerUI(songs[0]);
        }
    } catch (e) {
        console.error("Failed to update UI on init:", e);
    }

    setupCarouselNav('featured-prev', 'featured-next', 'featured-grid');
    setupCarouselNav('artist-prev', 'artist-next', 'artist-carousel');
    setupSidebarToggle();
};


function setupSidebarToggle() {
    const sidebar = document.getElementById('right-sidebar');
    const closeBtn = document.getElementById('rs-close-btn');
    const openBtn = document.getElementById('rs-open-btn');

    const toggle = () => {
        sidebar.classList.toggle('collapsed');
    };

    if (closeBtn) closeBtn.addEventListener('click', toggle);
    if (openBtn) openBtn.addEventListener('click', toggle);
}

function setupCarouselNav(prevId, nextId, gridId) {
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);
    const grid = document.getElementById(gridId);

    if (prev && next && grid) {
        prev.addEventListener('click', () => {
            grid.scrollBy({ left: -300, behavior: 'smooth' });
        });
        next.addEventListener('click', () => {
            grid.scrollBy({ left: 300, behavior: 'smooth' });
        });
    }
}

// Hook into Play to start AudioContext if needed
// Store original play only once
if (!audio.originalPlay) {
    audio.originalPlay = audio.play;
}
audio.play = async function () {
    try {
        if (window.Visualizer) {
            await window.Visualizer.setupAudio(); // make setup async-safe
        }
        if (window.AudioContext && window.Visualizer?.audioCtx?.state === 'suspended') {
            await window.Visualizer.audioCtx.resume(); // Resume context
        }
        return audio.originalPlay.apply(this, arguments);
    } catch (err) {
        console.error("Audio play failed:", err);
    }
};


// Start
init();


// --- Mini Player (PiP) Logic ---
let miniPlayerWindow = null;

async function toggleMiniPlayer() {
    if (miniPlayerWindow) {
        miniPlayerWindow.close();
        miniPlayerWindow = null;
        return;
    }

    if (!window.documentPictureInPicture) {
        alert("Mini Player (Document Picture-in-Picture) is not supported in this browser. Please use Chrome 116+ or Edge 116+.");
        return;
    }

    try {
        miniPlayerWindow = await documentPictureInPicture.requestWindow({
            width: 400,
            height: 500
        });

        const doc = miniPlayerWindow.document;

        // Copy Styles from Main Window
        [...document.styleSheets].forEach((styleSheet) => {
            try {
                if (styleSheet.href) {
                    const link = doc.createElement('link');
                    link.rel = 'stylesheet';
                    link.type = styleSheet.type;
                    link.media = styleSheet.media;
                    link.href = styleSheet.href;
                    doc.head.appendChild(link);
                } else {
                    const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
                    const style = doc.createElement('style');
                    style.textContent = cssRules;
                    doc.head.appendChild(style);
                }
            } catch (e) {
                console.warn("Could not copy stylesheet:", e);
            }
        });

        // Add FontAwesome explicitly to ensure icons work
        const faLink = doc.createElement('link');
        faLink.rel = 'stylesheet';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        doc.head.appendChild(faLink);

        // Build UI
        const currentSong = songs[currentSongIndex] || {};
        const isPlaying = !audio.paused;

        doc.body.innerHTML = `
            <div class="mini-player-container">
                <img src="${currentSong.cover || 'https://via.placeholder.com/300'}" class="mini-bg" id="mp-bg">
                <div class="mini-overlay">
                    <div class="mini-top-bar">
                        <div class="mini-logo"><i class="fa-solid fa-music"></i> BeatFlow</div>
                    </div>
                    
                    <div class="mini-controls-center">
                        <button class="mini-btn-control" id="mp-volume" title="Mute/Unmute">
                            ${audio.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>'}
                        </button>
                        <button class="mini-btn-control" id="mp-shuffle" title="Shuffle">
                            <i class="fa-solid fa-shuffle" style="color: ${isShuffleOn ? 'var(--primary-color)' : 'white'}"></i>
                        </button>
                        <button class="mini-btn-control" id="mp-prev"><i class="fa-solid fa-backward-step"></i></button>
                        <button class="mini-btn-play" id="mp-play">
                            ${isPlaying ? '<i class="fa-solid fa-circle-pause"></i>' : '<i class="fa-solid fa-circle-play"></i>'}
                        </button>
                        <button class="mini-btn-control" id="mp-next"><i class="fa-solid fa-forward-step"></i></button>
                        <button class="mini-btn-control" id="mp-loop" title="Loop">
                            <i class="fa-solid fa-repeat" style="color: ${audio.loop ? 'var(--primary-color)' : 'white'}"></i>
                        </button>
                        <button class="mini-btn-control" id="mp-share" title="Share">
                            <i class="fa-solid fa-share-from-square"></i>
                        </button>
                    </div>

                    <div class="mini-bottom-bar">
                        <div class="mini-progress-container" id="mp-progress">
                            <div class="mini-progress-fill" id="mp-progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="mini-meta">
                            <div class="mini-track-info">
                                <div class="mini-track-title" id="mp-title">${currentSong.title || 'No Song'}</div>
                                <div class="mini-track-artist" id="mp-artist">${currentSong.artist || 'Unknown'}</div>
                            </div>
                            <button class="mini-like-btn" id="mp-like">
                                ${isLiked(currentSong.id) ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Event Listeners within PiP
        // Play/Prev/Next
        doc.getElementById('mp-play').addEventListener('click', togglePlay);
        doc.getElementById('mp-prev').addEventListener('click', playPrev);
        doc.getElementById('mp-next').addEventListener('click', playNext);

        // Volume
        const volBtn = doc.getElementById('mp-volume');
        volBtn.addEventListener('click', () => {
            audio.muted = !audio.muted;
            // Update Mini Player UI
            volBtn.innerHTML = audio.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
            // Sync Main Player UI
            const mainMute = document.getElementById('mute-btn');
            if (mainMute) {
                mainMute.innerHTML = audio.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
            }
            const mainVol = document.getElementById('volume-slider');
            if (mainVol) {
                mainVol.value = audio.muted ? 0 : (audio.volume || 1);
            }
        });

        // Shuffle
        const shufBtn = doc.getElementById('mp-shuffle');
        shufBtn.addEventListener('click', () => {
            isShuffleOn = !isShuffleOn;
            // Update Mini Player UI
            shufBtn.innerHTML = `<i class="fa-solid fa-shuffle" style="color: ${isShuffleOn ? 'var(--primary-color)' : 'white'}"></i>`;
            // Sync Main Player UI
            const mainShuf = document.getElementById('shuffle-btn');
            if (mainShuf) {
                mainShuf.classList.toggle('active', isShuffleOn);
                mainShuf.style.color = isShuffleOn ? 'var(--primary-color)' : '#b3b3b3';
            }
        });

        // Loop
        const loopBtn = doc.getElementById('mp-loop');
        loopBtn.addEventListener('click', () => {
            audio.loop = !audio.loop;
            // Update Mini Player UI
            loopBtn.innerHTML = `<i class="fa-solid fa-repeat" style="color: ${audio.loop ? 'var(--primary-color)' : 'white'}"></i>`;
            // Sync Main Player UI
            const mainLoop = document.getElementById('loop-btn');
            if (mainLoop) {
                mainLoop.style.color = audio.loop ? 'var(--primary-color)' : '#b3b3b3';
            }
        });

        // Share
        doc.getElementById('mp-share').addEventListener('click', () => {
            const song = songs[currentSongIndex];
            if (!song) return;
            const text = `Listening to ${song.title} by ${song.artist} on BeatFlow!`;

            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    const icon = doc.querySelector('#mp-share i');
                    if (icon) {
                        icon.className = 'fa-solid fa-check';
                        icon.style.color = 'var(--primary-color)';
                        setTimeout(() => {
                            icon.className = 'fa-solid fa-share-from-square';
                            icon.style.color = 'white';
                        }, 2000);
                    }
                }).catch(err => {
                    console.error('Clipboard failed', err);
                    //  alert("Could not copy to clipboard. Permission denied?"); // Avoid alert in PiP if possible
                });
            }
        });

        // Like
        doc.getElementById('mp-like').addEventListener('click', () => {
            const song = songs[currentSongIndex];
            if (song) {
                toggleLike(song);
                updateMiniPlayerUI();
            }
        });

        // Seek
        doc.getElementById('mp-progress').addEventListener('click', (e) => {
            const width = doc.getElementById('mp-progress').clientWidth;
            const clickX = e.offsetX;
            const duration = audio.duration;
            audio.currentTime = (clickX / width) * duration;
        });

        // Cleanup
        miniPlayerWindow.addEventListener("pagehide", (event) => {
            miniPlayerWindow = null;
        });

        // Initial Progress
        updateMiniPlayerProgress(audio.currentTime, audio.duration);

    } catch (err) {
        console.error("Failed to open Mini Player:", err);
    }
}

function updateMiniPlayerUI() {
    if (!miniPlayerWindow) return;
    const doc = miniPlayerWindow.document;
    const song = songs[currentSongIndex];
    if (!song) return;

    const bg = doc.getElementById('mp-bg');
    if (bg) bg.src = song.cover;

    const title = doc.getElementById('mp-title');
    if (title) title.innerText = song.title;

    const artist = doc.getElementById('mp-artist');
    if (artist) artist.innerText = song.artist;

    // Update Play Button
    const playBtn = doc.getElementById('mp-play');
    if (playBtn) playBtn.innerHTML = !audio.paused ? '<i class="fa-solid fa-circle-pause"></i>' : '<i class="fa-solid fa-circle-play"></i>';

    // Update Like Button
    const liked = isLiked(song.id);
    const likeBtn = doc.getElementById('mp-like');
    if (likeBtn) {
        likeBtn.innerHTML = liked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        likeBtn.style.color = liked ? '#1db954' : '#fff';
    }

    // Update Shuffle State
    const shufBtn = doc.getElementById('mp-shuffle');
    if (shufBtn) {
        shufBtn.innerHTML = `<i class="fa-solid fa-shuffle" style="color: ${isShuffleOn ? 'var(--primary-color)' : 'white'}"></i>`;
    }

    // Update Loop State
    const loopBtn = doc.getElementById('mp-loop');
    if (loopBtn) {
        loopBtn.innerHTML = `<i class="fa-solid fa-repeat" style="color: ${audio.loop ? 'var(--primary-color)' : 'white'}"></i>`;
    }

    // Update Volume State
    const volBtn = doc.getElementById('mp-volume');
    if (volBtn) {
        volBtn.innerHTML = audio.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
    }
}

function updateMiniPlayerProgress(currentTime, duration) {
    if (!miniPlayerWindow) return;
    const doc = miniPlayerWindow.document;
    const fill = doc.getElementById('mp-progress-fill');
    if (fill && duration) {
        const percent = (currentTime / duration) * 100;
        fill.style.width = `${percent}%`;
    }
}
