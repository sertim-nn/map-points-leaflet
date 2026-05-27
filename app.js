        // ===============================
        // DATA & STATE
        // ===============================
        var pointsData = [];
        var markersByGroup = {};
        var groupVisibility = {};
        var customLists = [];
        var groupOutlines = {};
        var isDrawingMode = false;
        var currentDrawingListId = null;
        var drawingPath = [];
        var isMouseDown = false;
        var deliveryZones = [];
        var zoneVisibility = {};
        var isAddingPolygon = false;
        var currentDrawingShape = 'rectangle';
        var drawingStartPoint = null;
        var isResizing = false;
        var sidebarWidth = 280;
        var currentTab = 'map';

        var newZoneSchedules = {}; // zoneName -> { currentDays: Set, currentCycle, deliveryDays: Set, deliveryCycle, changeColor }
        var currentShareUrl = '';
        var isViewMode = false;
        var zoneLabelsVisible = false;

        var colorPalette = ['#a8c5e2', '#c9b8e0', '#b5d8cc', '#e8c4c4', '#f0d5c0', '#c4dce8', '#d4c4e8', '#bfd8bf', '#e0c4d4', '#c4d4e8'];

        // ===============================
        // TABS
        // ===============================
        function switchTab(tabName) {
            currentTab = tabName;
            document.querySelectorAll('.tab-btn').forEach(function(btn) {
                btn.classList.remove('active');
                if (btn.getAttribute('data-tab') === tabName) {
                    btn.classList.add('active');
                }
            });
            document.querySelectorAll('.tab-content').forEach(function(content) {
                content.classList.remove('active');
            });
            document.getElementById('tab-' + tabName).classList.add('active');
        }

        // ===============================
        // MAP INIT
        // ===============================
        var map = L.map('map', { 
            zoomControl: true,
            attributionControl: false
        }).setView([55.7558, 37.6173], 11);
        
        L.control.attribution({ prefix: false }).addTo(map);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OSM'
        }).addTo(map);

        map.on('zoomend', function() {
            document.getElementById('zoomLevel').textContent = map.getZoom();
        });

        // ===============================
        // SIDEBAR RESIZE
        // ===============================
        function initSidebarResize() {
            var sidebar = document.getElementById('sidebar');
            var resizer = document.getElementById('sidebarResizer');
            var minWidth = 280;
            var maxWidthPercent = 0.4;

            resizer.addEventListener('mousedown', function(e) {
                isResizing = true;
                document.body.classList.add('resizing');
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isResizing) return;
                var maxWidth = window.innerWidth * maxWidthPercent;
                var newWidth = e.clientX;
                if (newWidth < minWidth) newWidth = minWidth;
                if (newWidth > maxWidth) newWidth = maxWidth;
                sidebarWidth = newWidth;
                sidebar.style.width = newWidth + 'px';
                map.invalidateSize();
            });

            document.addEventListener('mouseup', function() {
                if (isResizing) {
                    isResizing = false;
                    document.body.classList.remove('resizing');
                }
            });
        }

        // ===============================
        // HELPER FUNCTIONS
        // ===============================
        function getPointsWord(n) {
            var cases = [2, 0, 1, 1, 1, 2];
            var words = ['точка', 'точки', 'точек'];
            return words[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
        }

        function getGroupsWord(n) {
            var cases = [2, 0, 1, 1, 1, 2];
            var words = ['группа', 'группы', 'групп'];
            return words[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
        }

        function getListsWord(n) {
            var cases = [2, 0, 1, 1, 1, 2];
            var words = ['список', 'списка', 'списков'];
            return words[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
        }

        function getZonesWord(n) {
            var cases = [2, 0, 1, 1, 1, 2];
            var words = ['зона', 'зоны', 'зон'];
            return words[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
        }

        function getPolygonsWord(n) {
            var cases = [2, 0, 1, 1, 1, 2];
            var words = ['область', 'области', 'областей'];
            return words[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
        }

        function showStatus(message, type) {
            type = type || 'info';
            var icons = { error: '<i class="fas fa-circle-xmark"></i>', success: '<i class="fas fa-circle-check"></i>', loading: '<i class="fas fa-spinner fa-spin"></i>', info: '<i class="fas fa-circle-info"></i>' };
            var el = document.getElementById('importStatus');
            el.className = 'status status-' + type;
            el.innerHTML = icons[type] + '<span>' + message + '</span>';
        }

        function showZoneStatus(message, type) {
            type = type || 'info';
            var icons = { error: '<i class="fas fa-circle-xmark"></i>', success: '<i class="fas fa-circle-check"></i>', loading: '<i class="fas fa-spinner fa-spin"></i>', info: '<i class="fas fa-circle-info"></i>' };
            var el = document.getElementById('zoneStatus');
            el.className = 'status status-' + type;
            el.innerHTML = icons[type] + '<span>' + message + '</span>';
        }

        function showBackupStatus(message, type) {
            type = type || 'info';
            var icons = { error: '<i class="fas fa-circle-xmark"></i>', success: '<i class="fas fa-circle-check"></i>', loading: '<i class="fas fa-spinner fa-spin"></i>', info: '<i class="fas fa-circle-info"></i>' };
            var el = document.getElementById('backupStatus');
            if (el) {
                el.className = 'status status-' + type;
                el.innerHTML = icons[type] + '<span>' + message + '</span>';
                setTimeout(function() { el.innerHTML = ''; el.className = ''; }, 3000);
            }
        }

        // ===============================
        // PROGRESS BAR
        // ===============================
        var progressSteps = [
            { id: 'read', label: 'Чтение', icon: 'fa-file-import' },
            { id: 'process', label: 'Обработка', icon: 'fa-cogs' },
            { id: 'display', label: 'Отображение', icon: 'fa-map-marked-alt' }
        ];

        function showProgress(percent, currentStep, error) {
            var container = document.getElementById('importProgressContainer');
            var statusEl = document.getElementById('importStatus');
            
            if (error) {
                container.style.display = 'block';
                statusEl.innerHTML = '';
                container.innerHTML = '<div class="progress-container">' +
                    '<div class="progress-header">' +
                    '<span class="progress-title"><i class="fas fa-times-circle" style="color: #9b4d4d;"></i> Ошибка импорта</span>' +
                    '</div>' +
                    '<div class="progress-error">' +
                    '<div class="progress-error-title"><i class="fas fa-exclamation-triangle"></i> Не удалось загрузить файл</div>' +
                    '<div class="progress-error-message">' + error + '</div>' +
                    '</div>' +
                    '</div>';
                return;
            }

            if (percent >= 100) {
                setTimeout(function() {
                    container.style.display = 'none';
                    container.innerHTML = '';
                }, 1500);
                return;
            }

            container.style.display = 'block';
            statusEl.innerHTML = '';

            var stepsHtml = '<div class="progress-steps">';
            var stepIndex = progressSteps.findIndex(function(s) { return s.id === currentStep; });
            
            progressSteps.forEach(function(step, index) {
                var stepClass = 'progress-step';
                var icon = '<i class="fas ' + step.icon + '"></i>';
                
                if (index < stepIndex) {
                    stepClass += ' completed';
                    icon = '<i class="fas fa-check"></i>';
                } else if (index === stepIndex) {
                    stepClass += ' active';
                }
                
                stepsHtml += '<div class="' + stepClass + '">' + icon + step.label + '</div>';
            });
            stepsHtml += '</div>';

            container.innerHTML = '<div class="progress-container">' +
                '<div class="progress-header">' +
                '<span class="progress-title"><i class="fas fa-spinner fa-spin"></i> Импорт файла</span>' +
                '<span class="progress-percent">' + Math.round(percent) + '%</span>' +
                '</div>' +
                '<div class="progress-bar-bg">' +
                '<div class="progress-bar-fill" style="width: ' + percent + '%;"></div>' +
                '</div>' +
                stepsHtml +
                '</div>';
        }

        function hideProgress() {
            var container = document.getElementById('importProgressContainer');
            container.style.display = 'none';
            container.innerHTML = '';
        }

        // ===============================
        // THEMES
        // ===============================
        var THEME_KEY = 'mappoints_theme';
        var currentTheme = 'light';

        function setTheme(theme) {
            currentTheme = theme;
            document.body.classList.remove('theme-light', 'theme-dark', 'theme-corporate');
            if (theme !== 'light') {
                document.body.classList.add('theme-' + theme);
            }
            
            // Update theme buttons
            document.querySelectorAll('.theme-btn').forEach(function(btn) {
                btn.classList.remove('active');
                if (btn.getAttribute('data-theme') === theme) {
                    btn.classList.add('active');
                }
            });
            
            // Save to localStorage
            try {
                localStorage.setItem(THEME_KEY, theme);
            } catch (e) {
                console.error('Error saving theme:', e);
            }
        }

        function loadTheme() {
            try {
                var savedTheme = localStorage.getItem(THEME_KEY);
                if (savedTheme && ['light', 'dark', 'corporate'].indexOf(savedTheme) !== -1) {
                    setTheme(savedTheme);
                }
            } catch (e) {
                console.error('Error loading theme:', e);
            }
        }

        // ===============================
        // MODALS
        // ===============================
        function openHelpModal() { document.getElementById('helpModal').classList.add('active'); }
        function closeHelpModal() { document.getElementById('helpModal').classList.remove('active'); }
        function openAddListModal() {
            document.getElementById('addListModal').classList.add('active');
            document.getElementById('listNameInput').value = '';
            setTimeout(function() { document.getElementById('listNameInput').focus(); }, 100);
        }
        function closeAddListModal() { document.getElementById('addListModal').classList.remove('active'); }

        // ===============================
        // SHAPE SELECTION
        // ===============================
        function selectShape(shape) {
            currentDrawingShape = shape;
            document.querySelectorAll('.shape-btn').forEach(function(btn) {
                btn.classList.remove('active');
                if (btn.getAttribute('data-shape') === shape) btn.classList.add('active');
            });
            updateHintText();
        }

        function updateHintText() {
            var hintText = document.getElementById('drawingHintText');
            if (!hintText) return;
            switch(currentDrawingShape) {
                case 'rectangle': hintText.textContent = 'Зажмите ЛКМ и растяните'; break;
                case 'circle': hintText.textContent = 'Зажмите ЛКМ и растяните круг'; break;
                case 'polygon': hintText.textContent = 'Зажмите ЛКМ и обведите область'; break;
            }
        }

        // ===============================
        // CUSTOM ICONS
        // ===============================
        function createCustomIcon(value, color, shape, color2) {
            shape = shape || 'circle';
            var text = (value !== undefined && value !== null) ? String(value) : '';
            var safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var svg = '';
            var gradientId = 'grad_' + Math.random().toString(36).substr(2, 9);
            var hasTwoColors = color2 && color2 !== color;

            if (shape === 'drop') {
                if (hasTwoColors) {
                    svg = '<svg width="17" height="22" viewBox="0 0 15 20" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="' + gradientId + '" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:' + color + ';stop-opacity:1" /><stop offset="70%" style="stop-color:' + color + ';stop-opacity:1" /><stop offset="70%" style="stop-color:' + color2 + ';stop-opacity:1" /><stop offset="100%" style="stop-color:' + color2 + ';stop-opacity:1" /></linearGradient></defs><path d="M7.5 0 C3.75 0 1 3 1 6 c0 5 6.5 12.5 6.5 12.5 s6.5-7.5 6.5-12.5 C14 3 11.25 0 7.5 0z" fill="url(#' + gradientId + ')" stroke="white" stroke-width="1.3"/><text x="7.5" y="7.5" text-anchor="middle" dominant-baseline="middle" font-size="6" font-weight="600" fill="white" font-family="Inter, sans-serif">' + safeText + '</text></svg>';
                } else {
                    svg = '<svg width="17" height="22" viewBox="0 0 15 20" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 0 C3.75 0 1 3 1 6 c0 5 6.5 12.5 6.5 12.5 s6.5-7.5 6.5-12.5 C14 3 11.25 0 7.5 0z" fill="' + color + '" stroke="white" stroke-width="1.3"/><text x="7.5" y="7.5" text-anchor="middle" dominant-baseline="middle" font-size="6" font-weight="600" fill="white" font-family="Inter, sans-serif">' + safeText + '</text></svg>';
                }
                return L.divIcon({ className: 'custom-div-icon', html: svg, iconSize: [17, 22], iconAnchor: [8.5, 22] });
            } else if (shape === 'flag') {
                if (hasTwoColors) {
                    svg = '<svg width="22" height="20" viewBox="0 0 20 18" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="' + gradientId + '" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:' + color + ';stop-opacity:1" /><stop offset="70%" style="stop-color:' + color + ';stop-opacity:1" /><stop offset="70%" style="stop-color:' + color2 + ';stop-opacity:1" /><stop offset="100%" style="stop-color:' + color2 + ';stop-opacity:1" /></linearGradient></defs><path d="M2 1 v16" stroke="white" stroke-width="2.5" stroke-linecap="round"/><path d="M2 1 v16" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round"/><path d="M4 2 h12 l-3 4 3 4 H4 z" fill="url(#' + gradientId + ')" stroke="white" stroke-width="1.5"/><text x="10" y="8" text-anchor="middle" dominant-baseline="middle" font-size="6" font-weight="600" fill="white" font-family="Inter, sans-serif">' + safeText + '</text></svg>';
                } else {
                    svg = '<svg width="22" height="20" viewBox="0 0 20 18" xmlns="http://www.w3.org/2000/svg"><path d="M2 1 v16" stroke="white" stroke-width="2.5" stroke-linecap="round"/><path d="M2 1 v16" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round"/><path d="M4 2 h12 l-3 4 3 4 H4 z" fill="' + color + '" stroke="white" stroke-width="1.5"/><text x="10" y="8" text-anchor="middle" dominant-baseline="middle" font-size="6" font-weight="600" fill="white" font-family="Inter, sans-serif">' + safeText + '</text></svg>';
                }
                return L.divIcon({ className: 'custom-div-icon', html: svg, iconSize: [22, 20], iconAnchor: [2, 19] });
            } else {
                if (hasTwoColors) {
                    svg = '<svg width="21" height="21" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="' + gradientId + '" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:' + color + ';stop-opacity:1" /><stop offset="70%" style="stop-color:' + color + ';stop-opacity:1" /><stop offset="70%" style="stop-color:' + color2 + ';stop-opacity:1" /><stop offset="100%" style="stop-color:' + color2 + ';stop-opacity:1" /></linearGradient></defs><circle cx="9" cy="9" r="7" fill="url(#' + gradientId + ')" stroke="white" stroke-width="1.5"/><text x="9" y="9" text-anchor="middle" dominant-baseline="central" font-size="7" font-weight="600" fill="white" font-family="Inter, sans-serif">' + safeText + '</text></svg>';
                } else {
                    svg = '<svg width="21" height="21" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="7" fill="' + color + '" stroke="white" stroke-width="1.5"/><text x="9" y="9" text-anchor="middle" dominant-baseline="central" font-size="7" font-weight="600" fill="white" font-family="Inter, sans-serif">' + safeText + '</text></svg>';
                }
                return L.divIcon({ className: 'custom-div-icon', html: svg, iconSize: [21, 21], iconAnchor: [10.5, 10.5] });
            }
        }

        // ===============================
        // POINTS RENDERING
        // ===============================
        function initializePoints() {
            Object.keys(markersByGroup).forEach(function(group) {
                (markersByGroup[group] || []).forEach(function(m) { map.removeLayer(m); });
                delete markersByGroup[group];
            });

            var groups = [];
            pointsData.forEach(function(p) { if (groups.indexOf(p.group) === -1) groups.push(p.group); });

            groups.forEach(function(g) {
                if (!markersByGroup[g]) markersByGroup[g] = [];
                if (groupVisibility[g] === undefined) groupVisibility[g] = false;
            });

            var markerIndex = 0;
            pointsData.forEach(function(p) {
                var displayValue = p.numberSymbol !== undefined ? p.numberSymbol : p.number;
                var marker = L.marker([p.lat, p.lng], { icon: createCustomIcon(displayValue, p.color, p.shape || 'circle', p.color2) });
                if (p.name) marker.bindTooltip(p.name, { direction: 'top', offset: [0, -8], opacity: 1 });

                var addressHtml = p.address ? '<div class="popup-row" style="flex-direction: column; align-items: flex-start; gap: 2px;"><span class="popup-label">Адрес</span><span class="popup-value" style="word-break: break-word; line-height: 1.3;">' + p.address + '</span></div>' : '';
                var codeHtml = p.code ? '<div class="popup-row"><span class="popup-label">Код ТТ</span><span class="popup-value">' + p.code + '</span></div>' : '';
                var popupContent = '<div class="popup-content"><div class="popup-title">' + (p.name || 'Без имени') + '</div><div class="popup-row"><span class="popup-label">Группа</span><span class="popup-value">' + p.group + '</span></div><div class="popup-row"><span class="popup-label">Значение</span><span class="popup-value">' + (displayValue !== undefined ? displayValue : '—') + '</span></div>' + codeHtml + addressHtml + '<div class="popup-coords"><i class="fas fa-location-dot" style="margin-right: 3px;"></i>' + p.lat.toFixed(6) + ', ' + p.lng.toFixed(6) + '</div></div>';
                marker.bindPopup(popupContent);

                if (groupVisibility[p.group]) {
                    marker.addTo(map);
                }
                markersByGroup[p.group].push(marker);
            });

            updateStats();
        }

        // ===============================
        // FILTERS
        // ===============================
        function sortGroups(groups) {
            return groups.slice().sort(function(a, b) {
                var aMatch = a.match(/^(\d+)/);
                var bMatch = b.match(/^(\d+)/);
                var aNum = aMatch ? parseInt(aMatch[1], 10) : null;
                var bNum = bMatch ? parseInt(bMatch[1], 10) : null;
                if (aNum !== null && bNum !== null) {
                    if (aNum !== bNum) return aNum - bNum;
                    return a.localeCompare(b, 'ru');
                }
                if (aNum !== null) return -1;
                if (bNum !== null) return 1;
                return a.localeCompare(b, 'ru');
            });
        }

        function createFilters() {
            var container = document.getElementById('groupFilters');
            var groups = [];
            pointsData.forEach(function(p) { if (groups.indexOf(p.group) === -1) groups.push(p.group); });
            groups = sortGroups(groups);

            document.getElementById('groupCount').textContent = groups.length + ' ' + getGroupsWord(groups.length);

            if (groups.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fas fa-folder-open" style="font-size: 20px; color: var(--text-muted);"></i></div><div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: 12px;">Нет загруженных точек</div><div style="font-size: 10px; color: var(--text-muted);">Перейдите на вкладку «Импорт»</div></div>';
                return;
            }

            container.innerHTML = '';

            groups.forEach(function(group, index) {
                var groupPoints = pointsData.filter(function(p) { return p.group === group; });
                var color = groupPoints[0] ? groupPoints[0].color : colorPalette[index % colorPalette.length];
                var count = groupPoints.length;
                var isVisible = groupVisibility[group] === true;
                var shape = groupPoints[0] ? groupPoints[0].shape : 'circle';
                var shapeIcon = shape === 'drop' ? 'fa-location-dot' : (shape === 'flag' ? 'fa-flag' : 'fa-circle');

                var div = document.createElement('div');
                div.className = 'group-card' + (isVisible ? ' active' : '');
                div.innerHTML = '<label style="display: flex; align-items: center; cursor: pointer; gap: 8px;"><div class="ios-checkbox"><input type="checkbox" ' + (isVisible ? 'checked' : '') + ' data-group="' + group.replace(/"/g, '&quot;') + '"><span class="checkmark"></span></div><div class="color-dot" style="background: ' + color + ';"><i class="fas ' + shapeIcon + '"></i></div><div style="flex: 1; min-width: 0;"><div class="group-name" title="' + group.replace(/"/g, '&quot;') + '">' + group + '</div></div><span class="badge">' + count + '</span><button class="group-btn" type="button" data-action="outline" data-group="' + group.replace(/"/g, '&quot;') + '" title="Выделить границы"><i class="fas fa-vector-square"></i></button></label>';
                
                div.querySelector('input[type="checkbox"]').addEventListener('change', function(e) { toggleGroup(group, e.target.checked); });
                div.querySelector('button[data-action="outline"]').addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); toggleGroupOutline(group); });
                
                container.appendChild(div);
            });

            updateGroupOutlineButtons();
        }

        function toggleGroup(group, visible) {
            groupVisibility[group] = visible;
            document.querySelectorAll('.group-card').forEach(function(card) {
                var checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox && checkbox.getAttribute('data-group') === group) {
                    if (visible) card.classList.add('active');
                    else card.classList.remove('active');
                }
            });
            var markers = markersByGroup[group] || [];
            markers.forEach(function(marker) {
                if (visible) {
                    marker.addTo(map);
                } else {
                    map.removeLayer(marker);
                }
            });
            updateStats();
        }

        function toggleAll(visible) {
            document.querySelectorAll('#groupFilters input[type="checkbox"]').forEach(function(cb) { cb.checked = visible; });
            document.querySelectorAll('.group-card').forEach(function(card) {
                if (visible) card.classList.add('active');
                else card.classList.remove('active');
            });
            Object.keys(markersByGroup).forEach(function(group) {
                groupVisibility[group] = visible;
                (markersByGroup[group] || []).forEach(function(marker) {
                    if (visible) marker.addTo(map);
                    else map.removeLayer(marker);
                });
            });
            updateStats();
        }

        function updateStats() {
            var visibleCount = 0;
            Object.keys(groupVisibility).forEach(function(g) {
                if (groupVisibility[g]) visibleCount += (markersByGroup[g] || []).length;
            });
            document.getElementById('visiblePoints').textContent = visibleCount;
            document.getElementById('totalPoints').textContent = pointsData.length;
        }

        // ===============================
        // GROUP OUTLINES
        // ===============================
        function toggleGroupOutline(group) {
            if (!pointsData || pointsData.length === 0) return;
            if (groupOutlines[group] && map.hasLayer(groupOutlines[group])) {
                map.removeLayer(groupOutlines[group]);
                delete groupOutlines[group];
                updateGroupOutlineButtons();
                return;
            }

            var pts = pointsData.filter(function(p) { return p.group === group; }).map(function(p) { return { lat: p.lat, lng: p.lng }; });
            if (pts.length < 2) { showStatus('Недостаточно точек', 'error'); return; }

            var latLngs = pts.length === 2 ? [L.latLng(pts[0].lat, pts[0].lng), L.latLng(pts[1].lat, pts[1].lng)] : convexHullLatLng(pts);
            var isPolygon = latLngs.length >= 3;
            var color = (pointsData.find(function(p){return p.group===group;}) || {}).color || '#7ba3cc';

            var layer = isPolygon
                ? L.polygon(latLngs, { color: color, fillColor: color, fillOpacity: 0.08, weight: 2, dashArray: '6, 6' })
                : L.polyline(latLngs, { color: color, weight: 3, dashArray: '6, 6' });

            layer.addTo(map);
            groupOutlines[group] = layer;
            try { map.fitBounds(layer.getBounds().pad(0.15)); } catch (e) {}
            updateGroupOutlineButtons();
        }

        function updateGroupOutlineButtons() {
            document.querySelectorAll('button[data-action="outline"]').forEach(function(btn) {
                var g = btn.getAttribute('data-group');
                var active = !!groupOutlines[g] && map.hasLayer(groupOutlines[g]);
                if (active) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }

        function convexHullLatLng(points) {
            var pts = points.map(function(p) { return { x: p.lng, y: p.lat }; });
            pts.sort(function(a, b) { return a.x !== b.x ? a.x - b.x : a.y - b.y; });
            function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
            var lower = [];
            for (var i = 0; i < pts.length; i++) {
                while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
                lower.push(pts[i]);
            }
            var upper = [];
            for (var j = pts.length - 1; j >= 0; j--) {
                while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[j]) <= 0) upper.pop();
                upper.push(pts[j]);
            }
            upper.pop(); lower.pop();
            return lower.concat(upper).map(function(p) { return L.latLng(p.y, p.x); });
        }

        // ===============================
        // IMPORT
        // ===============================
        function handleFile(file) {
            var fileName = (file && file.name) ? file.name.toLowerCase() : '';
            if (fileName.indexOf('.xlsx') === -1 && fileName.indexOf('.xls') === -1) { 
                showProgress(0, 'read', 'Неверный формат файла. Поддерживаются только Excel файлы (.xlsx, .xls)');
                return; 
            }
            
            // Шаг 1: Чтение файла
            showProgress(10, 'read');

            var reader = new FileReader();
            reader.onprogress = function(e) {
                if (e.lengthComputable) {
                    var percent = 10 + (e.loaded / e.total) * 25;
                    showProgress(percent, 'read');
                }
            };
            reader.onload = function(e) {
                try {
                    // Шаг 2: Обработка данных
                    showProgress(40, 'process');
                    
                    setTimeout(function() {
                        try {
                            var data = new Uint8Array(e.target.result);
                            showProgress(50, 'process');
                            
                            var workbook = XLSX.read(data, { type: 'array' });
                            showProgress(60, 'process');
                            
                            var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                            var rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                            showProgress(70, 'process');
                            
                            processImportedRows(rows);
                        } catch (err) { 
                            showProgress(0, 'process', 'Ошибка при обработке файла: ' + err.message);
                        }
                    }, 100);
                } catch (err) { 
                    showProgress(0, 'process', 'Ошибка при чтении данных: ' + err.message);
                }
            };
            reader.onerror = function() { 
                showProgress(0, 'read', 'Не удалось прочитать файл. Проверьте, что файл не повреждён.');
            };
            reader.readAsArrayBuffer(file);
        }

        function processImportedRows(rows) {
            if (!rows || !rows.length) { 
                showProgress(0, 'process', 'Файл пуст или не содержит данных');
                return; 
            }
            
            showProgress(75, 'process');

            var parsed = [];
            var colorIndex = 0;
            var colorByGroup = {};
            var allowedSymbols = ['@', '$', '&', '?'];
            var latinLetterRegex = /^[A-Za-z]$/;

            rows.forEach(function(row) {
                var latRaw = row['ШИРОТА (Широта)'] || row['ШИРОТА'] || row['Широта'] || row['широта'] || '';
                var lngRaw = row['ДОЛГОТА (Долгота)'] || row['ДОЛГОТА'] || row['Долгота'] || row['долгота'] || '';
                var lat = parseFloat(String(latRaw).replace(',', '.'));
                var lng = parseFloat(String(lngRaw).replace(',', '.'));
                if (isNaN(lat) || isNaN(lng)) return;

                var group = String(row['Группа'] || row['группа'] || 'Без группы').trim();
                var name = String(row['Имя'] || row['имя'] || '').trim();
                var address = String(row['Адрес'] || row['адрес'] || '').trim();
                var code = String(row['Код ТТ'] || row['код тт'] || row['Код'] || row['код'] || '').trim();

                var number, numberSymbol;
                var rawNum = String(row['Число'] !== undefined && row['Число'] !== null ? row['Число'] : '').trim();
                if (rawNum !== '') {
                    if (allowedSymbols.indexOf(rawNum) !== -1) numberSymbol = rawNum;
                    else if (latinLetterRegex.test(rawNum)) numberSymbol = rawNum.toUpperCase();
                    else { var num = Number(rawNum.replace(',', '.')); if (!isNaN(num)) number = num; else numberSymbol = rawNum; }
                }

                var colorRaw = String(row['Цвет'] || row['цвет'] || '').trim();
                var color = '', color2 = '';
                if (colorRaw && colorRaw.indexOf(',') !== -1) {
                    var colorParts = colorRaw.split(',').map(function(c) { return c.trim(); });
                    color = colorParts[0] || ''; color2 = colorParts[1] || '';
                } else { color = colorRaw; }
                
                if (!color) {
                    if (!colorByGroup[group]) { colorByGroup[group] = colorPalette[colorIndex % colorPalette.length]; colorIndex++; }
                    color = colorByGroup[group];
                } else if (!colorByGroup[group]) { colorByGroup[group] = color; }

                var shape = String(row['Форма'] || row['форма'] || '').trim().toLowerCase();
                if (shape !== 'circle' && shape !== 'drop' && shape !== 'flag') shape = 'circle';

                parsed.push({ group: group, name: name, lat: lat, lng: lng, number: number, numberSymbol: numberSymbol, color: color, color2: color2, shape: shape, address: address, code: code });
            });

            if (!parsed.length) { 
                showProgress(0, 'process', 'В файле не найдены координаты. Проверьте наличие столбцов "ШИРОТА" и "ДОЛГОТА".');
                return; 
            }

            // Шаг 3: Отображение на карте
            showProgress(85, 'display');
            
            pointsData = parsed;
            Object.keys(groupOutlines).forEach(function(g) { if (groupOutlines[g]) map.removeLayer(groupOutlines[g]); delete groupOutlines[g]; });
            Object.keys(groupVisibility).forEach(function(k) { delete groupVisibility[k]; });
            
            var groups = [];
            parsed.forEach(function(p) { if (groups.indexOf(p.group) === -1) groups.push(p.group); });
            groups.forEach(function(g) { groupVisibility[g] = false; });

            createFilters();
            showProgress(92, 'display');
            
            initializePoints();
            showProgress(97, 'display');
            
            fitToAllPoints();
            showProgress(100, 'display');
            
            // Показываем успешный статус после скрытия прогресс-бара
            setTimeout(function() {
                showStatus('Импортировано ' + parsed.length + ' ' + getPointsWord(parsed.length), 'success');
            }, 1600);
            
            switchTab('map');
            scheduleAutoSave();
        }

        function fitToAllPoints() {
            if (!pointsData.length) return;
            var bounds = L.latLngBounds(pointsData.map(function(p) { return [p.lat, p.lng]; }));
            map.fitBounds(bounds.pad(0.15));
        }

        function fitAllElements() {
            var allLatLngs = [];
            // Points
            pointsData.forEach(function(p) { allLatLngs.push([p.lat, p.lng]); });
            // Delivery zones
            deliveryZones.forEach(function(z) {
                if (z.coordinates) z.coordinates.forEach(function(c) { allLatLngs.push(c); });
            });
            // Custom list polygons
            customLists.forEach(function(list) {
                if (list.polygons) list.polygons.forEach(function(poly) {
                    poly.forEach(function(p) { allLatLngs.push([p.lat, p.lng]); });
                });
            });
            if (allLatLngs.length === 0) return;
            map.fitBounds(L.latLngBounds(allLatLngs).pad(0.1));
        }

        function downloadTemplate() {
            try {
                showStatus('Генерация...', 'loading');
                var templateData = [
                    ['Группа', 'Имя', 'ШИРОТА (Широта)', 'ДОЛГОТА (Долгота)', 'Число', 'Цвет', 'Форма', 'Адрес', 'Код ТТ'],
                    ['Магазины', 'ТЦ Мега', 55.7558, 37.6173, 1, '#a8c5e2', 'circle', 'г. Москва, 41-й км МКАД', 'MSK001'],
                    ['Магазины', 'ГУМ', 55.7546, 37.6215, '@', '#a8c5e2,#e8c4c4', 'circle', 'г. Москва, Красная площадь', 'MSK002'],
                    ['Рестораны', 'White Rabbit', 55.7516, 37.5861, '&', '#b5d8cc', 'drop', 'г. Москва, Смоленская пл.', 'RST001'],
                    ['Офисы', 'Москва-Сити', 55.7492, 37.5358, '$', '#c9b8e0', 'flag', 'г. Москва, Пресненская наб.', 'OFF001']
                ];
                var ws = XLSX.utils.aoa_to_sheet(templateData);
                ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 12 }];
                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Точки');
                XLSX.writeFile(wb, 'шаблон_точек.xlsx');
                showStatus('Шаблон скачан', 'success');
            } catch (err) { showStatus('Ошибка: ' + err.message, 'error'); }
        }

        // ===============================
        // CUSTOM LISTS
        // ===============================
        function createNewList() {
            var input = document.getElementById('listNameInput');
            var name = input.value.trim();
            if (!name) { input.style.borderColor = '#e8c4c4'; input.focus(); return; }
            customLists.push({ id: 'list_' + Date.now(), name: name, points: [], polygons: [], polygonLayers: [] });
            closeAddListModal();
            renderCustomLists();
            startDrawingMode(customLists[customLists.length - 1].id, false);
        }

        function renderCustomLists() {
            var container = document.getElementById('customListsContainer');
            document.getElementById('customListCount').textContent = customLists.length + ' ' + getListsWord(customLists.length);
            if (customLists.length === 0) { container.innerHTML = ''; return; }

            container.innerHTML = '';
            customLists.forEach(function(list) {
                var div = document.createElement('div');
                div.className = 'custom-list-card';
                div.id = 'list-card-' + list.id;
                if (currentDrawingListId === list.id) div.classList.add('drawing');

                var pointsCount = list.points.length;
                var polygonsCount = list.polygons ? list.polygons.length : 0;
                var statusText = pointsCount > 0 ? pointsCount + ' ' + getPointsWord(pointsCount) : 'Нет точек';
                if (polygonsCount > 0) statusText += ' • ' + polygonsCount + ' ' + getPolygonsWord(polygonsCount);
                var exportDisabled = pointsCount === 0 ? ' disabled' : '';

                div.innerHTML = '<div style="display: flex; align-items: center; gap: 8px;"><div style="width: 26px; height: 26px; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); border-radius: 6px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-object-group" style="color: white; font-size: 10px;"></i></div><div style="flex: 1; min-width: 0;"><div class="group-name" title="' + list.name.replace(/"/g, '&quot;') + '">' + list.name + '</div><div style="font-size: 9px; color: var(--text-muted); margin-top: 2px;">' + statusText + '</div></div><span class="custom-list-badge">' + pointsCount + '</span><div style="display: flex; gap: 4px;"><button class="export-list-btn" onclick="exportCustomList(\'' + list.id + '\')" title="Экспорт"' + exportDisabled + '><i class="fas fa-file-export"></i></button><button class="delete-list-btn" onclick="deleteCustomList(\'' + list.id + '\')" title="Удалить"><i class="fas fa-trash"></i></button></div></div>';

                var actionsDiv = document.createElement('div');
                actionsDiv.style.cssText = 'display: flex; gap: 6px; margin-top: 8px;';
                
                if (!isDrawingMode) {
                    var addPolygonBtn = document.createElement('button');
                    addPolygonBtn.className = 'btn btn-secondary';
                    addPolygonBtn.style.cssText = 'flex: 1; font-size: 10px; padding: 6px;';
                    addPolygonBtn.innerHTML = '<i class="fas fa-plus"></i> Добавить область';
                    addPolygonBtn.onclick = function() { startDrawingMode(list.id, true); };
                    actionsDiv.appendChild(addPolygonBtn);
                    
                    if (polygonsCount > 0) {
                        var clearBtn = document.createElement('button');
                        clearBtn.className = 'btn btn-secondary';
                        clearBtn.style.cssText = 'font-size: 10px; padding: 6px 10px;';
                        clearBtn.innerHTML = '<i class="fas fa-eraser"></i>';
                        clearBtn.title = 'Очистить области';
                        clearBtn.onclick = function() { clearListPolygons(list.id); };
                        actionsDiv.appendChild(clearBtn);
                    }
                }
                
                if (actionsDiv.children.length > 0) div.appendChild(actionsDiv);
                container.appendChild(div);
            });
        }

        function deleteCustomList(listId) {
            var idx = customLists.findIndex(function(l) { return l.id === listId; });
            if (idx === -1) return;
            var list = customLists[idx];
            if (list.polygonLayers) list.polygonLayers.forEach(function(layer) { map.removeLayer(layer); });
            customLists.splice(idx, 1);
            renderCustomLists();
            scheduleAutoSave();
        }

        function clearListPolygons(listId) {
            var list = customLists.find(function(l) { return l.id === listId; });
            if (!list) return;
            if (list.polygonLayers) list.polygonLayers.forEach(function(layer) { map.removeLayer(layer); });
            list.polygons = []; list.polygonLayers = []; list.points = [];
            renderCustomLists();
            scheduleAutoSave();
        }

        function exportCustomList(listId) {
            var list = customLists.find(function(l) { return l.id === listId; });
            if (!list || list.points.length === 0) { showStatus('Список пуст', 'error'); return; }
            try {
                showStatus('Экспорт...', 'loading');
                var exportData = [['Группа', 'Имя', 'ШИРОТА (Широта)', 'ДОЛГОТА (Долгота)', 'Число', 'Цвет', 'Форма', 'Адрес', 'Код ТТ']];
                list.points.forEach(function(idx) {
                    var p = pointsData[idx];
                    if (p) {
                        var numValue = p.numberSymbol !== undefined ? p.numberSymbol : (p.number !== undefined ? p.number : '');
                        var colorValue = p.color || '';
                        if (p.color2) colorValue = p.color + ',' + p.color2;
                        exportData.push([p.group || '', p.name || '', p.lat, p.lng, numValue, colorValue, p.shape || 'circle', p.address || '', p.code || '']);
                    }
                });
                var ws = XLSX.utils.aoa_to_sheet(exportData);
                ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 12 }];
                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Точки');
                var safeName = list.name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
                XLSX.writeFile(wb, safeName + '_' + list.points.length + '_точек.xlsx');
                showStatus('Экспорт: ' + list.points.length + ' ' + getPointsWord(list.points.length), 'success');
            } catch (err) { showStatus('Ошибка: ' + err.message, 'error'); }
        }

        // ===============================
        // DRAWING
        // ===============================
        function startDrawingMode(listId, addToExisting) {
            currentDrawingListId = listId;
            isDrawingMode = true;
            isAddingPolygon = addToExisting || false;
            drawingPath = [];
            drawingStartPoint = null;

            var canvas = document.getElementById('drawingCanvas');
            var mapContainer = document.getElementById('mapContainer');
            canvas.width = mapContainer.offsetWidth;
            canvas.height = mapContainer.offsetHeight;
            canvas.classList.add('active');
            document.getElementById('drawingHint').classList.add('active');
            selectShape('rectangle');
            
            var hintTitle = document.getElementById('drawingHintTitle');
            if (hintTitle) hintTitle.textContent = isAddingPolygon ? 'Добавление области' : 'Режим рисования';

            var card = document.getElementById('list-card-' + listId);
            if (card) card.classList.add('drawing');

            map.dragging.disable();
            map.touchZoom.disable();
            map.doubleClickZoom.disable();
            map.scrollWheelZoom.disable();
        }

        function cancelDrawing() { endDrawingMode(false); }

        function endDrawingMode(savePolygon) {
            isDrawingMode = false;
            isMouseDown = false;

            var canvas = document.getElementById('drawingCanvas');
            canvas.classList.remove('active');
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            document.getElementById('drawingHint').classList.remove('active');

            if (currentDrawingListId) {
                var card = document.getElementById('list-card-' + currentDrawingListId);
                if (card) card.classList.remove('drawing');
            }

            map.dragging.enable();
            map.touchZoom.enable();
            map.doubleClickZoom.enable();
            map.scrollWheelZoom.enable();

            if (savePolygon && drawingPath.length > 2) processDrawnPolygon();
            currentDrawingListId = null;
            drawingPath = [];
            drawingStartPoint = null;
            isAddingPolygon = false;
            renderCustomLists();
        }

        function processDrawnPolygon() {
            if (!currentDrawingListId || drawingPath.length < 3) return;
            var idx = customLists.findIndex(function(l) { return l.id === currentDrawingListId; });
            if (idx === -1) return;

            var latLngPath = drawingPath.map(function(point) { return map.containerPointToLatLng(L.point(point.x, point.y)); });
            var polygonColors = ['#6b7280', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
            var colorIndex = customLists[idx].polygons ? customLists[idx].polygons.length % polygonColors.length : 0;
            var polygonColor = polygonColors[colorIndex];

            var polygon = L.polygon(latLngPath, { color: polygonColor, fillColor: polygonColor, fillOpacity: 0.15, weight: 2, dashArray: '5, 5' }).addTo(map);
            
            if (!customLists[idx].polygons) customLists[idx].polygons = [];
            if (!customLists[idx].polygonLayers) customLists[idx].polygonLayers = [];
            
            customLists[idx].polygons.push(latLngPath);
            customLists[idx].polygonLayers.push(polygon);
            recalculateListPoints(idx);
            scheduleAutoSave();
        }

        function recalculateListPoints(listIndex) {
            var list = customLists[listIndex];
            if (!list || !list.polygons) return;
            
            var pointsInside = [];
            pointsData.forEach(function(point, index) {
                var isInside = list.polygons.some(function(polygon) { return isPointInPolygon([point.lat, point.lng], polygon); });
                if (isInside && pointsInside.indexOf(index) === -1) pointsInside.push(index);
            });
            customLists[listIndex].points = pointsInside;
        }

        function isPointInPolygon(point, polygon) {
            var x = point[0], y = point[1];
            var inside = false;
            for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                var xi = polygon[i].lat, yi = polygon[i].lng;
                var xj = polygon[j].lat, yj = polygon[j].lng;
                var intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        function drawRectangle(ctx, startX, startY, endX, endY) {
            ctx.beginPath();
            ctx.rect(startX, startY, endX - startX, endY - startY);
            ctx.fillStyle = 'rgba(107, 114, 128, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#6b7280';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
        }

        function drawCircleShape(ctx, startX, startY, endX, endY) {
            var centerX = (startX + endX) / 2;
            var centerY = (startY + endY) / 2;
            var radius = Math.max(Math.abs(endX - startX), Math.abs(endY - startY)) / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(107, 114, 128, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#6b7280';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
        }

        function drawPolygonPath(ctx, path) {
            if (path.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (var i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(107, 114, 128, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#6b7280';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
        }

        function getRectanglePoints(startX, startY, endX, endY) {
            return [{ x: startX, y: startY }, { x: endX, y: startY }, { x: endX, y: endY }, { x: startX, y: endY }];
        }

        function getCirclePoints(startX, startY, endX, endY, numPoints) {
            numPoints = numPoints || 32;
            var centerX = (startX + endX) / 2;
            var centerY = (startY + endY) / 2;
            var radius = Math.max(Math.abs(endX - startX), Math.abs(endY - startY)) / 2;
            var points = [];
            for (var i = 0; i < numPoints; i++) {
                var angle = (i / numPoints) * 2 * Math.PI;
                points.push({ x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) });
            }
            return points;
        }

        // ===============================
        // DELIVERY ZONES
        // ===============================
        function handleZoneFile(file) {
            var fileName = (file && file.name) ? file.name.toLowerCase() : '';
            var isJson = fileName.indexOf('.json') !== -1;
            var isTxt = fileName.indexOf('.txt') !== -1;
            if (!isJson && !isTxt) { showZoneStatus('Только TXT или JSON', 'error'); return; }
            showZoneStatus('Загрузка...', 'loading');

            var reader = new FileReader();
            reader.onload = function(e) {
                try { isJson ? processZoneJsonFile(e.target.result) : processZoneFile(e.target.result); }
                catch (err) { showZoneStatus('Ошибка: ' + err.message, 'error'); }
            };
            reader.onerror = function() { showZoneStatus('Ошибка чтения', 'error'); };
            reader.readAsText(file, 'UTF-8');
        }

        var dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

        function formatDaysSchedule(days, label) {
            if (!days || !Array.isArray(days)) return '';
            var enabledDays = [];
            days.forEach(function(day, index) {
                if (day.enabled) enabledDays.push({ name: dayNames[index], from: day.from_time || '', till: day.till_time || '' });
            });
            if (enabledDays.length === 0) return '<div class="popup-row"><span class="popup-label">' + label + '</span><span class="popup-value" style="color: #9b4d4d;">Нет</span></div>';
            var daysStr = enabledDays.map(function(d) { return d.name; }).join(', ');
            var timeStr = enabledDays.length > 0 && enabledDays[0].from ? ' (' + enabledDays[0].from + '-' + enabledDays[0].till + ')' : '';
            return '<div class="popup-row" style="flex-direction: column; align-items: flex-start; gap: 2px;"><span class="popup-label">' + label + '</span><span class="popup-value">' + daysStr + timeStr + '</span></div>';
        }

        function processZoneJsonFile(content) {
            if (!content || content.trim() === '') { showZoneStatus('Файл пуст', 'error'); return; }
            var jsonData;
            try { jsonData = JSON.parse(content); } catch (e) { showZoneStatus('Ошибка JSON', 'error'); return; }
            if (!Array.isArray(jsonData)) jsonData = [jsonData];

            var zones = [];
            jsonData.forEach(function(item) {
                if (!item.geo || !item.geo.shape || !item.geo.shape.features) return;
                var zoneName = item.geo.name || 'Без названия';
                var takeOrderDays = item.take_order ? item.take_order.days : null;
                var deliveryOrderDays = item.delivery_order ? item.delivery_order.days : null;

                item.geo.shape.features.forEach(function(feature) {
                    if (!feature.geometry || feature.geometry.type !== 'Polygon') return;
                    var coords = feature.geometry.coordinates;
                    if (!coords || !coords[0]) return;
                    var coordinates = coords[0].map(function(coord) { return [coord[1], coord[0]]; });
                    if (coordinates.length < 3) return;
                    zones.push({ name: zoneName, coordinates: coordinates, takeOrderDays: takeOrderDays, deliveryOrderDays: deliveryOrderDays });
                });
            });

            if (zones.length === 0) { showZoneStatus('Зоны не найдены', 'error'); return; }

            zones.forEach(function(zone) {
                var zoneId = 'zone_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                var polygon = L.polygon(zone.coordinates, { color: '#6b7280', fillColor: '#9ca3af', fillOpacity: 0.2, weight: 2 }).addTo(map);
                var zoneObj = { id: zoneId, name: zone.name, coordinates: zone.coordinates, polygon: polygon, visible: true, takeOrderDays: zone.takeOrderDays, deliveryOrderDays: zone.deliveryOrderDays };
                rebindZonePopup(zoneObj);
                deliveryZones.push(zoneObj);
                zoneVisibility[zoneId] = true;
            });

            renderDeliveryZones();
            var allCoords = [];
            zones.forEach(function(z) { z.coordinates.forEach(function(c) { allCoords.push(c); }); });
            if (allCoords.length > 0) map.fitBounds(L.latLngBounds(allCoords).pad(0.1));
            showZoneStatus('Загружено ' + zones.length + ' ' + getZonesWord(zones.length), 'success');
            scheduleAutoSave();
        }

        function processZoneFile(content) {
            if (!content || content.trim() === '') { showZoneStatus('Файл пуст', 'error'); return; }
            var lines = content.split('\n').map(function(line) { return line.trim(); }).filter(function(line) { return line !== ''; });
            if (lines.length < 2) { showZoneStatus('Недостаточно данных', 'error'); return; }

            var zones = [];
            var currentZone = null;

            lines.forEach(function(line) {
                var isCoordLine = /^\d/.test(line) && line.indexOf(',') !== -1;
                if (!isCoordLine) {
                    if (currentZone && currentZone.coordinates.length >= 3) zones.push(currentZone);
                    currentZone = { name: line, coordinates: [] };
                } else if (currentZone) {
                    var parts = line.split(',').map(function(p) { return p.trim(); });
                    if (parts.length >= 2) {
                        var lat = parseFloat(parts[0].replace(',', '.'));
                        var lng = parseFloat(parts[1].replace(',', '.'));
                        if (!isNaN(lat) && !isNaN(lng)) currentZone.coordinates.push([lat, lng]);
                    }
                }
            });

            if (currentZone && currentZone.coordinates.length >= 3) zones.push(currentZone);
            if (zones.length === 0) { showZoneStatus('Зоны не найдены', 'error'); return; }

            zones.forEach(function(zone) {
                var zoneId = 'zone_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                var polygon = L.polygon(zone.coordinates, { color: '#6b7280', fillColor: '#9ca3af', fillOpacity: 0.2, weight: 2 }).addTo(map);
                polygon.bindPopup('<div class="popup-content"><div class="popup-title">' + zone.name + '</div></div>');
                deliveryZones.push({ id: zoneId, name: zone.name, coordinates: zone.coordinates, polygon: polygon, visible: true });
                zoneVisibility[zoneId] = true;
            });

            renderDeliveryZones();
            var allCoords = [];
            zones.forEach(function(z) { z.coordinates.forEach(function(c) { allCoords.push(c); }); });
            if (allCoords.length > 0) map.fitBounds(L.latLngBounds(allCoords).pad(0.1));
            showZoneStatus('Загружено ' + zones.length + ' ' + getZonesWord(zones.length), 'success');
            scheduleAutoSave();
        }

        function renderDeliveryZones() {
            var container = document.getElementById('deliveryZonesContainer');
            document.getElementById('zoneCount').textContent = deliveryZones.length + ' ' + getZonesWord(deliveryZones.length);
            if (deliveryZones.length === 0) { container.innerHTML = ''; return; }

            container.innerHTML = '';
            deliveryZones.forEach(function(zone) {
                var div = document.createElement('div');
                div.className = 'zone-card' + (zone.visible ? ' active' : '') + (zone.hasChanges ? ' changed' : '');
                div.id = 'zone-card-' + zone.id;

                var chC = zone.changeColor || '#f59e0b';
                var chCD = zone.hasChanges ? shadeColor(chC, -15) : '';
                var changedBadge = zone.hasChanges ? '<span class="zone-changed-badge" style="background:linear-gradient(135deg,' + chC + ',' + chCD + ')"><i class="fas fa-exclamation"></i> изменено</span>' : '';
                var iconBg = zone.hasChanges ? 'linear-gradient(135deg,' + chC + ',' + chCD + ')' : 'linear-gradient(135deg,#9ca3af,#6b7280)';
                div.innerHTML = '<div style="display: flex; align-items: center; gap: 8px;"><div class="ios-checkbox"><input type="checkbox" ' + (zone.visible ? 'checked' : '') + ' data-zone-id="' + zone.id + '"><span class="checkmark"></span></div><div style="width: 22px; height: 22px; background: ' + iconBg + '; border-radius: 4px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-draw-polygon" style="color: white; font-size: 9px;"></i></div><div style="flex: 1; min-width: 0;"><div class="group-name" title="' + zone.name.replace(/"/g, '&quot;') + '">' + zone.name + '</div></div>' + changedBadge + '<div style="display: flex; gap: 4px;"><button class="zone-btn" onclick="centerOnZone(\'' + zone.id + '\')" title="Центрировать"><i class="fas fa-crosshairs"></i></button><button class="zone-btn danger" onclick="deleteZone(\'' + zone.id + '\')" title="Удалить"><i class="fas fa-trash"></i></button></div></div>';

                div.querySelector('input[type="checkbox"]').addEventListener('change', function(e) { toggleZone(zone.id, e.target.checked); });
                container.appendChild(div);
            });
        }

        function toggleZone(zoneId, visible) {
            var zone = deliveryZones.find(function(z) { return z.id === zoneId; });
            if (!zone) return;
            zone.visible = visible;
            zoneVisibility[zoneId] = visible;
            if (visible) zone.polygon.addTo(map);
            else map.removeLayer(zone.polygon);
            var card = document.getElementById('zone-card-' + zoneId);
            if (card) { if (visible) card.classList.add('active'); else card.classList.remove('active'); }
        }

        function toggleAllZones(visible) {
            deliveryZones.forEach(function(zone) {
                zone.visible = visible;
                zoneVisibility[zone.id] = visible;
                if (visible) zone.polygon.addTo(map);
                else map.removeLayer(zone.polygon);
            });
            renderDeliveryZones();
        }

        function centerOnZone(zoneId) {
            var zone = deliveryZones.find(function(z) { return z.id === zoneId; });
            if (zone && zone.polygon) map.fitBounds(zone.polygon.getBounds().pad(0.1));
        }

        function deleteZone(zoneId) {
            var idx = deliveryZones.findIndex(function(z) { return z.id === zoneId; });
            if (idx === -1) return;
            var zone = deliveryZones[idx];
            if (zone.polygon) map.removeLayer(zone.polygon);
            deliveryZones.splice(idx, 1);
            delete zoneVisibility[zoneId];
            renderDeliveryZones();
            scheduleAutoSave();
        }

        // ===============================
        // LOCAL STORAGE & BACKUP
        // ===============================
        var STORAGE_KEY = 'mappoints_data';
        var AUTO_SAVE_DELAY = 2000;
        var PROJECT_PREFIX = 'mappoints_project_v1_';
        var autoSaveTimeout = null;

        function saveToLocalStorage() {
            try {
                var dataToSave = {
                    version: 1,
                    timestamp: new Date().toISOString(),
                    pointsData: pointsData,
                    groupVisibility: groupVisibility,
                    customLists: customLists.map(function(list) {
                        return { id: list.id, name: list.name, points: list.points, polygons: list.polygons ? list.polygons.map(function(poly) { return poly.map(function(p) { return { lat: p.lat, lng: p.lng }; }); }) : [] };
                    }),
                    deliveryZones: deliveryZones.map(function(zone) {
                        return { id: zone.id, name: zone.name, coordinates: zone.coordinates, visible: zone.visible,
                            takeOrderDays: zone.takeOrderDays, deliveryOrderDays: zone.deliveryOrderDays,
                            newSchedule: zone.newSchedule ? {
                                currentDays: Array.from(zone.newSchedule.currentDays || new Set()),
                                currentCycle: zone.newSchedule.currentCycle || '',
                                deliveryDays: zone.newSchedule.deliveryDays ? Array.from(zone.newSchedule.deliveryDays) : null,
                                deliveryCycle: zone.newSchedule.deliveryCycle || '',
                                changeColor: zone.newSchedule.changeColor || '#f59e0b'
                            } : null,
                            changeColor: zone.changeColor || '', currentCycle: zone.currentCycle || '', newDeliveryCycle: zone.newDeliveryCycle || '',
                            hasChanges: zone.hasChanges || false, deliveryChanged: zone.deliveryChanged || false, cycleChanged: zone.cycleChanged || false };
                    }),
                    zoneVisibility: zoneVisibility
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
            } catch (e) { console.error('Ошибка сохранения:', e); }
        }

        function scheduleAutoSave() {
            if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(function() { saveToLocalStorage(); }, AUTO_SAVE_DELAY);
        }

        function loadFromLocalStorage() {
            try {
                var savedData = localStorage.getItem(STORAGE_KEY);
                if (!savedData) return false;
                var data = JSON.parse(savedData);
                if (!data || !data.pointsData) return false;

                pointsData = data.pointsData || [];
                groupVisibility = data.groupVisibility || {};

                if (data.deliveryZones && data.deliveryZones.length > 0) {
                    data.deliveryZones.forEach(function(zone) {
                        var hasChg = zone.hasChanges || false;
                        var chC = zone.changeColor || '#f59e0b';
                        var polygon = L.polygon(zone.coordinates, {
                            color: '#6b7280', fillColor: hasChg ? chC : '#9ca3af',
                            fillOpacity: hasChg ? 0.15 : 0.2, weight: 2,
                            dashArray: hasChg ? '10, 6' : null
                        });
                        var ns = null;
                        if (zone.newSchedule) {
                            ns = {
                                currentDays: new Set(zone.newSchedule.currentDays || []),
                                currentCycle: zone.newSchedule.currentCycle || '',
                                deliveryDays: zone.newSchedule.deliveryDays ? new Set(zone.newSchedule.deliveryDays) : null,
                                deliveryCycle: zone.newSchedule.deliveryCycle || '',
                                changeColor: zone.newSchedule.changeColor || '#f59e0b'
                            };
                            newZoneSchedules[zone.name] = ns;
                        }
                        var zoneObj = { id: zone.id, name: zone.name, coordinates: zone.coordinates, polygon: polygon,
                            visible: zone.visible, takeOrderDays: zone.takeOrderDays, deliveryOrderDays: zone.deliveryOrderDays,
                            newSchedule: ns, changeColor: zone.changeColor || '', currentCycle: zone.currentCycle || '', newDeliveryCycle: zone.newDeliveryCycle || '',
                            hasChanges: hasChg, deliveryChanged: zone.deliveryChanged, cycleChanged: zone.cycleChanged };
                        rebindZonePopup(zoneObj);
                        if (zone.visible) polygon.addTo(map);
                        deliveryZones.push(zoneObj);
                        zoneVisibility[zone.id] = zone.visible;
                    });
                    renderDeliveryZones();
                    var changedCount = deliveryZones.filter(function(z) { return z.hasChanges; }).length;
                    if (changedCount > 0) updateChangesStats(changedCount);
                }

                if (data.customLists && data.customLists.length > 0) {
                    var polygonColors = ['#6b7280', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
                    data.customLists.forEach(function(listData) {
                        var list = { id: listData.id, name: listData.name, points: listData.points || [], polygons: [], polygonLayers: [] };
                        if (listData.polygons && listData.polygons.length > 0) {
                            listData.polygons.forEach(function(polyData, idx) {
                                var latLngPath = polyData.map(function(p) { return L.latLng(p.lat, p.lng); });
                                var polygonColor = polygonColors[idx % polygonColors.length];
                                var polygon = L.polygon(latLngPath, { color: polygonColor, fillColor: polygonColor, fillOpacity: 0.15, weight: 2, dashArray: '5, 5' }).addTo(map);
                                list.polygons.push(latLngPath);
                                list.polygonLayers.push(polygon);
                            });
                        }
                        customLists.push(list);
                    });
                    renderCustomLists();
                }

                if (pointsData.length > 0) {
                    createFilters();
                    initializePoints();
                    fitToAllPoints();
                }

                return true;
            } catch (e) { console.error('Ошибка загрузки:', e); return false; }
        }

        function exportBackup() {
            try {
                var backupData = {
                    version: 1, appName: 'MapPoints', exportDate: new Date().toISOString(),
                    pointsData: pointsData, groupVisibility: groupVisibility,
                    customLists: customLists.map(function(list) {
                        return { id: list.id, name: list.name, points: list.points, polygons: list.polygons ? list.polygons.map(function(poly) { return poly.map(function(p) { return { lat: p.lat, lng: p.lng }; }); }) : [] };
                    }),
                    deliveryZones: deliveryZones.map(function(zone) {
                        return { id: zone.id, name: zone.name, coordinates: zone.coordinates, visible: zone.visible, takeOrderDays: zone.takeOrderDays, deliveryOrderDays: zone.deliveryOrderDays };
                    }),
                    zoneVisibility: zoneVisibility
                };
                var blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'mappoints_backup_' + new Date().toISOString().slice(0, 10) + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showBackupStatus('Бекап сохранён', 'success');
            } catch (e) { showBackupStatus('Ошибка: ' + e.message, 'error'); }
        }

        function importBackup(file) {
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = JSON.parse(e.target.result);
                    if (!data.appName || data.appName !== 'MapPoints') { showBackupStatus('Неверный формат', 'error'); return; }
                    clearAllData();
                    pointsData = data.pointsData || [];
                    groupVisibility = data.groupVisibility || {};

                    if (data.deliveryZones && data.deliveryZones.length > 0) {
                        data.deliveryZones.forEach(function(zone) {
                            var hasChg = zone.hasChanges || false;
                            var chC = zone.changeColor || '#f59e0b';
                            var polygon = L.polygon(zone.coordinates, {
                                color: '#6b7280', fillColor: hasChg ? chC : '#9ca3af',
                                fillOpacity: hasChg ? 0.15 : 0.2, weight: 2,
                                dashArray: hasChg ? '10, 6' : null
                            });
                            var ns = null;
                            if (zone.newSchedule) {
                                ns = {
                                    currentDays: new Set(zone.newSchedule.currentDays || []),
                                    currentCycle: zone.newSchedule.currentCycle || '',
                                    deliveryDays: zone.newSchedule.deliveryDays ? new Set(zone.newSchedule.deliveryDays) : null,
                                    deliveryCycle: zone.newSchedule.deliveryCycle || '',
                                    changeColor: zone.newSchedule.changeColor || '#f59e0b'
                                };
                                newZoneSchedules[zone.name] = ns;
                            }
                            var zoneObj = { id: zone.id, name: zone.name, coordinates: zone.coordinates, polygon: polygon,
                                visible: zone.visible, takeOrderDays: zone.takeOrderDays, deliveryOrderDays: zone.deliveryOrderDays,
                                newSchedule: ns, changeColor: zone.changeColor || '', currentCycle: zone.currentCycle || '', newDeliveryCycle: zone.newDeliveryCycle || '',
                                hasChanges: hasChg, deliveryChanged: zone.deliveryChanged, cycleChanged: zone.cycleChanged };
                            rebindZonePopup(zoneObj);
                            if (zone.visible) polygon.addTo(map);
                            deliveryZones.push(zoneObj);
                            zoneVisibility[zone.id] = zone.visible;
                        });
                        renderDeliveryZones();
                    }

                    if (data.customLists && data.customLists.length > 0) {
                        var polygonColors = ['#6b7280', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
                        data.customLists.forEach(function(listData) {
                            var list = { id: listData.id, name: listData.name, points: listData.points || [], polygons: [], polygonLayers: [] };
                            if (listData.polygons && listData.polygons.length > 0) {
                                listData.polygons.forEach(function(polyData, idx) {
                                    var latLngPath = polyData.map(function(p) { return L.latLng(p.lat, p.lng); });
                                    var polygonColor = polygonColors[idx % polygonColors.length];
                                    var polygon = L.polygon(latLngPath, { color: polygonColor, fillColor: polygonColor, fillOpacity: 0.15, weight: 2, dashArray: '5, 5' }).addTo(map);
                                    list.polygons.push(latLngPath);
                                    list.polygonLayers.push(polygon);
                                });
                            }
                            customLists.push(list);
                        });
                        renderCustomLists();
                    }

                    if (pointsData.length > 0) { createFilters(); initializePoints(); fitToAllPoints(); }
                    saveToLocalStorage();

                    var stats = [];
                    if (pointsData.length > 0) stats.push(pointsData.length + ' точек');
                    if (deliveryZones.length > 0) stats.push(deliveryZones.length + ' зон');
                    if (customLists.length > 0) stats.push(customLists.length + ' списков');
                    showBackupStatus('Восстановлено: ' + (stats.length > 0 ? stats.join(', ') : 'пусто'), 'success');
                    switchTab('map');
                } catch (err) { showBackupStatus('Ошибка: ' + err.message, 'error'); }
            };
            reader.onerror = function() { showBackupStatus('Ошибка чтения', 'error'); };
            reader.readAsText(file);
        }

        function clearAllData() {
            Object.keys(markersByGroup).forEach(function(group) {
                (markersByGroup[group] || []).forEach(function(m) { map.removeLayer(m); });
                delete markersByGroup[group];
            });
            Object.keys(groupOutlines).forEach(function(g) { if (groupOutlines[g]) map.removeLayer(groupOutlines[g]); delete groupOutlines[g]; });
            deliveryZones.forEach(function(zone) { if (zone.polygon) map.removeLayer(zone.polygon); });
            deliveryZones = [];
            zoneVisibility = {};
            newZoneSchedules = {};
            customLists.forEach(function(list) { if (list.polygonLayers) list.polygonLayers.forEach(function(layer) { map.removeLayer(layer); }); });
            customLists = [];
            pointsData = [];
            groupVisibility = {};
        }

        function confirmClearAllData() {
            if (!confirm('Вы уверены? Все данные будут удалены.')) return;
            clearAllData();
            createFilters();
            renderCustomLists();
            renderDeliveryZones();
            updateStats();
            localStorage.removeItem(STORAGE_KEY);
            showBackupStatus('Данные очищены', 'success');
        }

        // ===============================
        // ZONE SCHEDULE COMPARISON
        // ===============================
        var dayNamesLC = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

        function oldDaysToSet(daysArray) {
            if (!daysArray || !Array.isArray(daysArray)) return new Set();
            var result = new Set();
            daysArray.forEach(function(day, index) {
                if (day && day.enabled) result.add(dayNames[index]);
            });
            return result;
        }

        function parseDaysList(str) {
            if (!str || String(str).trim() === '') return new Set();
            var parts = String(str).split(/[,;\s]+/).map(function(s) { return s.trim(); }).filter(Boolean);
            var result = new Set();
            parts.forEach(function(p) {
                var idx = dayNamesLC.indexOf(p.toLowerCase());
                if (idx !== -1) result.add(dayNames[idx]);
            });
            return result;
        }

        function setsEqual(a, b) {
            if (a.size !== b.size) return false;
            var aArr = Array.from(a);
            for (var i = 0; i < aArr.length; i++) {
                if (!b.has(aArr[i])) return false;
            }
            return true;
        }

        function handleZoneScheduleExcel(file) {
            var fileName = (file && file.name) ? file.name.toLowerCase() : '';
            if (fileName.indexOf('.xlsx') === -1 && fileName.indexOf('.xls') === -1) {
                showScheduleStatus('Только Excel файлы (.xlsx, .xls)', 'error'); return;
            }
            showScheduleStatus('Загрузка...', 'loading');
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = new Uint8Array(e.target.result);
                    var workbook = XLSX.read(data, { type: 'array' });
                    var sheet = workbook.Sheets[workbook.SheetNames[0]];
                    var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    processZoneScheduleRows(rows);
                } catch (err) { showScheduleStatus('Ошибка: ' + err.message, 'error'); }
            };
            reader.onerror = function() { showScheduleStatus('Ошибка чтения файла', 'error'); };
            reader.readAsArrayBuffer(file);
        }

        function normalizeCycle(str) {
            var s = (str || '').toLowerCase().trim();
            if (s === 'чет' || s === 'чётная' || s === 'четная' || s === 'ч' || s === 'even') return 'чет';
            if (s === 'нечет' || s === 'нечётная' || s === 'нечетная' || s === 'н' || s === 'odd') return 'нечет';
            return '';
        }

        function fmtDaysWithCycle(daysStr, cycle) {
            if (!daysStr) return 'нет';
            return daysStr + (cycle ? ' (' + cycle + '.нед)' : '');
        }

        function processZoneScheduleRows(rows) {
            if (!rows || !rows.length) { showScheduleStatus('Файл пуст', 'error'); return; }
            var count = 0;
            rows.forEach(function(row) {
                var zoneName = String(row['Зона'] || row['зона'] || row['Название'] || row['название'] || '').trim();
                if (!zoneName) return;
                var currDStr  = String(row['Дни доставки']     || row['дни доставки']     || row['Доставка']         || row['доставка']         || '').trim();
                var currCycle = normalizeCycle(String(row['Цикл']                          || row['цикл']             || ''));
                var newDStr   = String(row['Дни доставки new']  || row['дни доставки new'] || row['Доставка new']     || row['доставка new']     || row['Новые дни'] || '').trim();
                var newCycle  = normalizeCycle(String(row['Цикл new']                      || row['цикл new']         || row['Цикл New']         || ''));
                var chColor   = String(row['Цвет']              || row['цвет']             || '').trim();
                newZoneSchedules[zoneName] = {
                    currentDays: parseDaysList(currDStr),
                    currentCycle: currCycle,
                    deliveryDays: newDStr ? parseDaysList(newDStr) : null,
                    deliveryCycle: newCycle,
                    changeColor: chColor || '#f59e0b'
                };
                count++;
            });
            if (count === 0) { showScheduleStatus('Не найден столбец «Зона»', 'error'); return; }
            applyNewSchedules();
            var changedCount = deliveryZones.filter(function(z) { return z.hasChanges; }).length;
            showScheduleStatus('Обновлено ' + count + ' зон, изменений: ' + changedCount, 'success');
            updateChangesStats(changedCount);
            renderDeliveryZones();
            scheduleAutoSave();
        }

        function applyNewSchedules() {
            deliveryZones.forEach(function(zone) {
                var ns = newZoneSchedules[zone.name];
                if (!ns) { zone.hasChanges = false; return; }
                zone.newSchedule = ns;
                zone.changeColor = ns.changeColor || '#f59e0b';

                // Effective current days: from Excel if provided, else from JSON
                var effCurrDays = (ns.currentDays && ns.currentDays.size > 0) ? ns.currentDays : oldDaysToSet(zone.deliveryOrderDays);
                zone.currentCycle = ns.currentCycle || '';
                zone.newDeliveryCycle = ns.deliveryCycle || '';

                if (!ns.deliveryDays || ns.deliveryDays.size === 0) {
                    // No new days supplied → no change
                    zone.hasChanges = false; zone.deliveryChanged = false; zone.cycleChanged = false;
                    if (zone.polygon) {
                        zone.polygon.setStyle({ color: '#6b7280', fillColor: '#9ca3af', fillOpacity: 0.2, weight: 2 });
                        rebindZonePopup(zone);
                    }
                    return;
                }

                zone.deliveryChanged = !setsEqual(effCurrDays, ns.deliveryDays);
                zone.cycleChanged    = zone.currentCycle !== zone.newDeliveryCycle;
                zone.hasChanges      = zone.deliveryChanged || zone.cycleChanged;

                if (zone.polygon) {
                    if (zone.hasChanges) {
                        zone.polygon.setStyle({ color: '#6b7280', fillColor: zone.changeColor, fillOpacity: 0.15, weight: 2, dashArray: '10, 6' });
                    } else {
                        zone.polygon.setStyle({ color: '#6b7280', fillColor: '#9ca3af', fillOpacity: 0.2, weight: 2, dashArray: null });
                    }
                    rebindZonePopup(zone);
                }
            });
        }

        function rebindZonePopup(zone) {
            var chColor = zone.changeColor || '#d97706';
            var html = '<div class="popup-content"><div class="popup-title">';
            if (zone.hasChanges) html += '<i class="fas fa-exclamation-circle" style="color:' + chColor + ';margin-right:4px;"></i>';
            html += zone.name + '</div>';

            if (zone.newSchedule && zone.newSchedule.deliveryDays && zone.newSchedule.deliveryDays.size > 0) {
                // New schedule loaded
                var ns = zone.newSchedule;
                var effCurr = (ns.currentDays && ns.currentDays.size > 0) ? ns.currentDays : oldDaysToSet(zone.deliveryOrderDays);
                var oldDStr = Array.from(effCurr).join(', ') || 'нет';
                var newDStr = Array.from(ns.deliveryDays).join(', ') || 'нет';

                if (zone.deliveryChanged || zone.cycleChanged) {
                    html += '<div class="popup-row" style="flex-direction:column;align-items:flex-start;gap:4px;">' +
                        '<span class="popup-label" style="color:' + chColor + ';font-weight:700;font-size:12px;">&#9650; Доставка изменена</span>' +
                        '<span class="popup-value" style="text-decoration:line-through;color:#9b4d4d;font-size:13px;">Было: ' + fmtDaysWithCycle(oldDStr, zone.currentCycle) + '</span>' +
                        '<span class="popup-value" style="color:#2d7a5e;font-size:13px;">Стало: ' + fmtDaysWithCycle(newDStr, zone.newDeliveryCycle) + '</span></div>';
                } else {
                    html += '<div class="popup-row"><span class="popup-label">Доставка</span>' +
                        '<span class="popup-value">' + fmtDaysWithCycle(oldDStr, zone.currentCycle) + '</span></div>';
                }
            } else {
                // No comparison loaded — show days from JSON or Excel current
                var ns2 = zone.newSchedule;
                var days = (ns2 && ns2.currentDays && ns2.currentDays.size > 0)
                    ? Array.from(ns2.currentDays).join(', ')
                    : (zone.deliveryOrderDays ? Array.from(oldDaysToSet(zone.deliveryOrderDays)).join(', ') : '');
                var cycle = (ns2 && ns2.currentCycle) ? ns2.currentCycle : (zone.currentCycle || '');
                if (days) {
                    html += '<div class="popup-row"><span class="popup-label">Доставка</span>' +
                        '<span class="popup-value">' + fmtDaysWithCycle(days, cycle) + '</span></div>';
                }
            }
            html += '</div>';
            zone.polygon.bindPopup(html);
        }

        function updateChangesStats(changedCount) {
            var el = document.getElementById('changesStats');
            if (!el) return;
            el.style.display = 'block';
            if (changedCount === 0) {
                el.innerHTML = '<div class="status status-success"><i class="fas fa-check-circle"></i><span>Изменений нет — расписания совпадают</span></div>';
            } else {
                el.innerHTML = '<div class="status" style="background:rgba(245,158,11,0.15);color:#92400e;">' +
                    '<i class="fas fa-exclamation-triangle"></i><span>Найдено изменений: <strong>' + changedCount + '</strong> ' + getZonesWord(changedCount) + '</span></div>';
            }
        }

        function showScheduleStatus(message, type) {
            type = type || 'info';
            var icons = { error: '<i class="fas fa-circle-xmark"></i>', success: '<i class="fas fa-circle-check"></i>', loading: '<i class="fas fa-spinner fa-spin"></i>', info: '<i class="fas fa-circle-info"></i>' };
            var el = document.getElementById('scheduleStatus');
            if (el) { el.className = 'status status-' + type; el.innerHTML = icons[type] + '<span>' + message + '</span>'; }
        }

        function downloadScheduleTemplate() {
            try {
                var header = ['Зона', 'Дни доставки', 'Цикл', 'Дни доставки new', 'Цикл new', 'Цвет'];
                var rows = [header];
                if (deliveryZones.length > 0) {
                    deliveryZones.forEach(function(z) {
                        var currDays = (z.newSchedule && z.newSchedule.currentDays && z.newSchedule.currentDays.size > 0)
                            ? Array.from(z.newSchedule.currentDays).join(',')
                            : Array.from(oldDaysToSet(z.deliveryOrderDays)).join(',');
                        var currCycle = (z.newSchedule && z.newSchedule.currentCycle) ? z.newSchedule.currentCycle : (z.currentCycle || '');
                        var newDays   = (z.newSchedule && z.newSchedule.deliveryDays && z.newSchedule.deliveryDays.size > 0)
                            ? Array.from(z.newSchedule.deliveryDays).join(',') : '';
                        var newCycle  = z.newDeliveryCycle || '';
                        var color     = z.changeColor || '';
                        rows.push([z.name, currDays, currCycle, newDays, newCycle, color]);
                    });
                } else {
                    rows.push(['(Y02) Ижевск2 (810)', 'Ср',    '',       'Чт',    '',       '#f59e0b']);
                    rows.push(['(Y04) Ижевск4 (810)', 'Вт,Пт', 'нечет',  'Вт,Пт', 'чет',   '#ef4444']);
                }
                var ws = XLSX.utils.aoa_to_sheet(rows);
                ws['!cols'] = [{ wch: 34 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 12 }];
                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Расписание');
                XLSX.writeFile(wb, 'шаблон_расписания.xlsx');
            } catch (err) { showScheduleStatus('Ошибка: ' + err.message, 'error'); }
        }

        function shadeColor(hex, pct) {
            var num = parseInt((hex || '#888888').replace('#',''), 16);
            var r = Math.min(255, Math.max(0, (num >> 16) + pct));
            var g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
            var b = Math.min(255, Math.max(0, (num & 0xff) + pct));
            return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
        }

        // ===============================
        // SHARE LINK
        // ===============================
        function generateShareLink() {
            try {
                var data = {
                    version: 2,
                    pointsData: pointsData,
                    groupVisibility: groupVisibility,
                    customLists: customLists.map(function(list) {
                        return { id: list.id, name: list.name, points: list.points,
                            polygons: list.polygons ? list.polygons.map(function(poly) {
                                return poly.map(function(p) { return { lat: p.lat, lng: p.lng }; });
                            }) : [] };
                    }),
                    deliveryZones: deliveryZones.map(function(zone) {
                        return { id: zone.id, name: zone.name, coordinates: zone.coordinates,
                            visible: zone.visible, takeOrderDays: zone.takeOrderDays, deliveryOrderDays: zone.deliveryOrderDays,
                            newSchedule: zone.newSchedule ? {
                                currentDays: Array.from(zone.newSchedule.currentDays || new Set()),
                                currentCycle: zone.newSchedule.currentCycle || '',
                                deliveryDays: zone.newSchedule.deliveryDays ? Array.from(zone.newSchedule.deliveryDays) : null,
                                deliveryCycle: zone.newSchedule.deliveryCycle || '',
                                changeColor: zone.newSchedule.changeColor || '#f59e0b'
                            } : null,
                            changeColor: zone.changeColor || '', currentCycle: zone.currentCycle || '', newDeliveryCycle: zone.newDeliveryCycle || '',
                            hasChanges: zone.hasChanges || false, deliveryChanged: zone.deliveryChanged || false, cycleChanged: zone.cycleChanged || false };
                    }),
                    zoneVisibility: zoneVisibility
                };
                var json = JSON.stringify(data);
                if (json.length > 600000) {
                    showShareStatus('Данные слишком большие (> 600 КБ). Уменьшите кол-во точек или зон.', 'error');
                    return;
                }
                var compressed = LZString.compressToEncodedURIComponent(json);
                var baseUrl = window.location.href.split('#')[0];
                currentShareUrl = baseUrl + '#share=' + compressed;

                document.getElementById('shareUrlPreview').value = currentShareUrl;
                document.getElementById('shareUrlContainer').style.display = 'block';

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(currentShareUrl).then(function() {
                        showShareStatus('Ссылка скопирована в буфер обмена!', 'success');
                    }).catch(function() { doFallbackCopy(); });
                } else { doFallbackCopy(); }
            } catch (e) { showShareStatus('Ошибка: ' + e.message, 'error'); }
        }

        function copyShareUrl() {
            var ta = document.getElementById('shareUrlPreview');
            if (ta) { ta.select(); ta.setSelectionRange(0, 99999); }
            if (!currentShareUrl) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(currentShareUrl).then(function() {
                    showShareStatus('Ссылка скопирована!', 'success');
                }).catch(doFallbackCopy);
            } else { doFallbackCopy(); }
        }

        function doFallbackCopy() {
            var ta = document.createElement('textarea');
            ta.value = currentShareUrl;
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            try { document.execCommand('copy'); showShareStatus('Ссылка скопирована!', 'success'); }
            catch (e) { showShareStatus('Скопируйте ссылку из поля выше', 'info'); }
            document.body.removeChild(ta);
        }

        function showShareStatus(message, type) {
            type = type || 'info';
            var icons = { error: '<i class="fas fa-circle-xmark"></i>', success: '<i class="fas fa-circle-check"></i>', loading: '<i class="fas fa-spinner fa-spin"></i>', info: '<i class="fas fa-circle-info"></i>' };
            var el = document.getElementById('shareStatus');
            if (el) {
                el.className = 'status status-' + type;
                el.innerHTML = icons[type] + '<span>' + message + '</span>';
                setTimeout(function() { if (el) { el.innerHTML = ''; el.className = ''; } }, 4000);
            }
        }

        // Shared restore logic used by loadFromShareLink, loadFromViewLink, loadProject
        function restoreDataObject(data) {
            clearAllData();
            pointsData = data.pointsData || [];
            groupVisibility = data.groupVisibility || {};
            var polygonColors = ['#6b7280', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
            if (data.deliveryZones && data.deliveryZones.length > 0) {
                data.deliveryZones.forEach(function(z) {
                    var hasChg = z.hasChanges || false;
                    var chC = z.changeColor || '#f59e0b';
                    var polygon = L.polygon(z.coordinates, {
                        color: '#6b7280', fillColor: hasChg ? chC : '#9ca3af',
                        fillOpacity: hasChg ? 0.15 : 0.2, weight: 2,
                        dashArray: hasChg ? '10, 6' : null
                    });
                    var ns = null;
                    if (z.newSchedule) {
                        ns = {
                            currentDays: new Set(z.newSchedule.currentDays || []),
                            currentCycle: z.newSchedule.currentCycle || '',
                            deliveryDays: z.newSchedule.deliveryDays ? new Set(z.newSchedule.deliveryDays) : null,
                            deliveryCycle: z.newSchedule.deliveryCycle || '',
                            changeColor: z.newSchedule.changeColor || '#f59e0b'
                        };
                        newZoneSchedules[z.name] = ns;
                    }
                    var zoneObj = { id: z.id, name: z.name, coordinates: z.coordinates, polygon: polygon,
                        visible: z.visible, takeOrderDays: z.takeOrderDays, deliveryOrderDays: z.deliveryOrderDays,
                        newSchedule: ns, changeColor: z.changeColor || '', currentCycle: z.currentCycle || '', newDeliveryCycle: z.newDeliveryCycle || '',
                        hasChanges: hasChg, deliveryChanged: z.deliveryChanged, cycleChanged: z.cycleChanged };
                    rebindZonePopup(zoneObj);
                    if (z.visible) polygon.addTo(map);
                    deliveryZones.push(zoneObj);
                    zoneVisibility[z.id] = z.visible;
                });
                renderDeliveryZones();
                var changedCount = deliveryZones.filter(function(z) { return z.hasChanges; }).length;
                if (changedCount > 0) updateChangesStats(changedCount);
            }
            if (data.customLists && data.customLists.length > 0) {
                data.customLists.forEach(function(listData) {
                    var list = { id: listData.id, name: listData.name, points: listData.points || [], polygons: [], polygonLayers: [] };
                    if (listData.polygons) {
                        listData.polygons.forEach(function(polyData, idx) {
                            var lls = polyData.map(function(p) { return L.latLng(p.lat, p.lng); });
                            var pc = polygonColors[idx % polygonColors.length];
                            var poly = L.polygon(lls, { color: pc, fillColor: pc, fillOpacity: 0.15, weight: 2, dashArray: '5, 5' }).addTo(map);
                            list.polygons.push(lls); list.polygonLayers.push(poly);
                        });
                    }
                    customLists.push(list);
                });
                renderCustomLists();
            }
            if (pointsData.length > 0) { createFilters(); initializePoints(); }
            setTimeout(function() { fitAllElements(); }, 200);
            return true;
        }

        function loadFromShareLink() {
            var hash = window.location.hash;
            if (!hash || hash.indexOf('#share=') !== 0) return false;
            var compressed = hash.substring(7);
            if (!compressed) return false;
            try {
                var json = LZString.decompressFromEncodedURIComponent(compressed);
                if (!json) return false;
                var data = JSON.parse(json);
                if (!data || data.version !== 2) return false;
                if (!restoreDataObject(data)) return false;
                history.replaceState(null, null, window.location.pathname + window.location.search);
                return true;
            } catch (e) {
                console.error('Ошибка загрузки ссылки:', e);
                return false;
            }
        }

        function showViewExpiredScreen() {
            var screen = document.getElementById('viewExpiredScreen');
            if (screen) screen.style.display = 'flex';
            var main = document.querySelector('.main-container');
            if (main) main.style.display = 'none';
        }

        function loadFromViewLink() {
            var hash = window.location.hash;
            if (!hash || hash.indexOf('#view=') !== 0) return false;

            // Session already has a view loaded → user is refreshing → show expired screen.
            // This fires regardless of whether the hash is still in the URL or not.
            if (sessionStorage.getItem('mappoints_view_session') === '1') {
                showViewExpiredScreen();
                return true; // returning true prevents the editor from loading
            }

            var compressed = hash.substring(6);
            if (!compressed) return false;
            try {
                var json = LZString.decompressFromEncodedURIComponent(compressed);
                if (!json) return false;
                var data = JSON.parse(json);
                if (!data || data.version !== 2) return false;
                if (!restoreDataObject(data)) return false;
                isViewMode = true;
                document.body.classList.add('view-mode');
                var overlay = document.getElementById('viewModeOverlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                    var nameEl = document.getElementById('viewModeProjectName');
                    if (nameEl) nameEl.textContent = data.projectName || 'MapPoints';
                }
                // Mark session BEFORE cleaning hash so any refresh triggers expired screen
                sessionStorage.setItem('mappoints_view_session', '1');
                history.replaceState(null, null, window.location.pathname + window.location.search);
                return true;
            } catch (e) {
                console.error('Ошибка загрузки view-ссылки:', e);
                return false;
            }
        }

        // ===============================
        // PROJECTS
        // ===============================
        function buildCurrentDataPayload(projectName) {
            return {
                version: 2,
                projectName: projectName || '',
                pointsData: pointsData,
                groupVisibility: groupVisibility,
                customLists: customLists.map(function(list) {
                    return { id: list.id, name: list.name, points: list.points,
                        polygons: list.polygons ? list.polygons.map(function(poly) {
                            return poly.map(function(p) { return { lat: p.lat, lng: p.lng }; });
                        }) : [] };
                }),
                deliveryZones: deliveryZones.map(function(zone) {
                    return { id: zone.id, name: zone.name, coordinates: zone.coordinates,
                        visible: zone.visible, takeOrderDays: zone.takeOrderDays, deliveryOrderDays: zone.deliveryOrderDays,
                        newSchedule: zone.newSchedule ? {
                            currentDays: Array.from(zone.newSchedule.currentDays || new Set()),
                            currentCycle: zone.newSchedule.currentCycle || '',
                            deliveryDays: zone.newSchedule.deliveryDays ? Array.from(zone.newSchedule.deliveryDays) : null,
                            deliveryCycle: zone.newSchedule.deliveryCycle || '',
                            changeColor: zone.newSchedule.changeColor || '#f59e0b'
                        } : null,
                        changeColor: zone.changeColor || '', currentCycle: zone.currentCycle || '', newDeliveryCycle: zone.newDeliveryCycle || '',
                        hasChanges: zone.hasChanges || false, deliveryChanged: zone.deliveryChanged || false, cycleChanged: zone.cycleChanged || false };
                }),
                zoneVisibility: zoneVisibility
            };
        }

        function saveCurrentProject() {
            var nameEl = document.getElementById('projectNameInput');
            var name = nameEl ? nameEl.value.trim() : '';
            if (!name) { showProjectStatus('Введите название проекта', 'error'); return; }
            try {
                var payload = buildCurrentDataPayload(name);
                var stored = { version: 2, savedAt: new Date().toISOString(), name: name, data: payload };
                localStorage.setItem(PROJECT_PREFIX + name, JSON.stringify(stored));
                if (nameEl) nameEl.value = '';
                showProjectStatus('Проект «' + name + '» сохранён', 'success');
                renderProjectsList();
            } catch (e) { showProjectStatus('Ошибка сохранения: ' + e.message, 'error'); }
        }

        function listProjects() {
            var projects = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf(PROJECT_PREFIX) === 0) {
                    try {
                        var stored = JSON.parse(localStorage.getItem(key));
                        if (stored && stored.name) projects.push({ name: stored.name, savedAt: stored.savedAt });
                    } catch (e) {}
                }
            }
            projects.sort(function(a, b) { return (b.savedAt || '').localeCompare(a.savedAt || ''); });
            return projects;
        }

        function loadProject(name) {
            var raw = localStorage.getItem(PROJECT_PREFIX + name);
            if (!raw) { showProjectStatus('Проект не найден', 'error'); return; }
            try {
                var stored = JSON.parse(raw);
                var data = stored.data;
                if (!data || data.version !== 2) { showProjectStatus('Неверный формат', 'error'); return; }
                restoreDataObject(data);
                updateStats();
                saveToLocalStorage(); // make this the active auto-save state
                showProjectStatus('Проект «' + name + '» загружен', 'success');
                switchTab('map');
            } catch (e) { showProjectStatus('Ошибка загрузки: ' + e.message, 'error'); }
        }

        function deleteProject(name) {
            if (!confirm('Удалить проект «' + name + '»?')) return;
            localStorage.removeItem(PROJECT_PREFIX + name);
            var container = document.getElementById('viewLinkContainer');
            if (container) container.style.display = 'none';
            renderProjectsList();
        }

        function generateProjectViewLink(name) {
            var raw = localStorage.getItem(PROJECT_PREFIX + name);
            if (!raw) { showProjectStatus('Проект не найден', 'error'); return; }
            try {
                var stored = JSON.parse(raw);
                var data = stored.data;
                if (!data) { showProjectStatus('Неверный формат', 'error'); return; }
                data.projectName = name;
                var json = JSON.stringify(data);
                if (json.length > 600000) { showProjectStatus('Проект слишком большой для ссылки', 'error'); return; }
                var compressed = LZString.compressToEncodedURIComponent(json);
                var viewUrl = window.location.href.split('#')[0] + '#view=' + compressed;
                var container = document.getElementById('viewLinkContainer');
                var preview = document.getElementById('viewLinkPreview');
                if (preview) preview.value = viewUrl;
                if (container) container.style.display = 'block';
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(viewUrl).then(function() {
                        showProjectStatus('Ссылка для просмотра скопирована!', 'success');
                    }).catch(function() { doProjectFallbackCopy(viewUrl); });
                } else { doProjectFallbackCopy(viewUrl); }
            } catch (e) { showProjectStatus('Ошибка: ' + e.message, 'error'); }
        }

        function doProjectFallbackCopy(url) {
            var ta = document.createElement('textarea');
            ta.value = url;
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            try { document.execCommand('copy'); showProjectStatus('Ссылка скопирована!', 'success'); }
            catch (e) { showProjectStatus('Скопируйте ссылку из поля ниже', 'info'); }
            document.body.removeChild(ta);
        }

        function showProjectStatus(message, type) {
            type = type || 'info';
            var icons = { error: '<i class="fas fa-circle-xmark"></i>', success: '<i class="fas fa-circle-check"></i>', info: '<i class="fas fa-circle-info"></i>' };
            var el = document.getElementById('projectsSaveStatus');
            if (el) {
                el.className = 'status status-' + (type === 'error' ? 'error' : type === 'success' ? 'success' : 'loading');
                el.innerHTML = icons[type] + '<span>' + message + '</span>';
                setTimeout(function() { if (el) { el.innerHTML = ''; el.className = ''; } }, 4000);
            }
        }

        function formatProjectDate(iso) {
            if (!iso) return '';
            try {
                var d = new Date(iso);
                return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
                    + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            } catch (e) { return ''; }
        }

        function escapeHtml(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function renderProjectsList() {
            var container = document.getElementById('projectsList');
            if (!container) return;
            var projects = listProjects();
            var countEl = document.getElementById('projectsCount');
            if (countEl) countEl.textContent = projects.length;
            if (projects.length === 0) {
                container.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 8px 0 4px;">Нет сохранённых проектов</div>';
                return;
            }
            container.innerHTML = projects.map(function(p) {
                var s = p.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                return '<div class="project-card">'
                    + '<div class="project-card-info">'
                    + '<div class="project-card-name">' + escapeHtml(p.name) + '</div>'
                    + '<div class="project-card-date">' + formatProjectDate(p.savedAt) + '</div>'
                    + '</div>'
                    + '<button class="zone-btn" onclick="loadProject(\'' + s + '\')" title="Загрузить проект"><i class="fas fa-folder-open"></i></button>'
                    + '<button class="zone-btn" onclick="generateProjectViewLink(\'' + s + '\')" title="Ссылка для просмотра"><i class="fas fa-link"></i></button>'
                    + '<button class="zone-btn danger" onclick="deleteProject(\'' + s + '\')" title="Удалить"><i class="fas fa-trash"></i></button>'
                    + '</div>';
            }).join('');
        }

        // ===============================
        // EVENT LISTENERS
        // ===============================
        document.addEventListener('DOMContentLoaded', function() {
            initSidebarResize();

            var fileInput = document.getElementById('fileInput');
            var dropZone = document.getElementById('dropZone');
            var zoneFileInput = document.getElementById('zoneFileInput');
            var zoneDropZone = document.getElementById('zoneDropZone');

            document.getElementById('btnChoose').addEventListener('click', function() { fileInput.click(); });
            dropZone.addEventListener('click', function() { fileInput.click(); });
            fileInput.addEventListener('change', function(e) { if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; });

            ['dragenter', 'dragover'].forEach(function(evt) { dropZone.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('active'); }); });
            ['dragleave', 'drop'].forEach(function(evt) { dropZone.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('active'); }); });
            dropZone.addEventListener('drop', function(e) { if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

            document.getElementById('btnTemplate').addEventListener('click', downloadTemplate);

            zoneDropZone.addEventListener('click', function() { zoneFileInput.click(); });
            zoneFileInput.addEventListener('change', function(e) { if (e.target.files && e.target.files[0]) handleZoneFile(e.target.files[0]); e.target.value = ''; });

            ['dragenter', 'dragover'].forEach(function(evt) { zoneDropZone.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); zoneDropZone.classList.add('active'); }); });
            ['dragleave', 'drop'].forEach(function(evt) { zoneDropZone.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); zoneDropZone.classList.remove('active'); }); });
            zoneDropZone.addEventListener('drop', function(e) { if (e.dataTransfer.files && e.dataTransfer.files[0]) handleZoneFile(e.dataTransfer.files[0]); });

            // Drawing canvas
            var canvas = document.getElementById('drawingCanvas');
            var ctx = canvas.getContext('2d');

            canvas.addEventListener('mousedown', function(e) {
                if (!isDrawingMode) return;
                isMouseDown = true;
                var rect = canvas.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                drawingStartPoint = { x: x, y: y };
                drawingPath = [{ x: x, y: y }];
            });

            canvas.addEventListener('mousemove', function(e) {
                if (!isDrawingMode || !isMouseDown) return;
                var rect = canvas.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (currentDrawingShape === 'rectangle') drawRectangle(ctx, drawingStartPoint.x, drawingStartPoint.y, x, y);
                else if (currentDrawingShape === 'circle') drawCircleShape(ctx, drawingStartPoint.x, drawingStartPoint.y, x, y);
                else { drawingPath.push({ x: x, y: y }); drawPolygonPath(ctx, drawingPath); }
            });

            canvas.addEventListener('mouseup', function(e) {
                if (!isDrawingMode || !isMouseDown) return;
                var rect = canvas.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                if (currentDrawingShape === 'rectangle') drawingPath = getRectanglePoints(drawingStartPoint.x, drawingStartPoint.y, x, y);
                else if (currentDrawingShape === 'circle') drawingPath = getCirclePoints(drawingStartPoint.x, drawingStartPoint.y, x, y, 32);
                endDrawingMode(true);
            });

            canvas.addEventListener('mouseleave', function(e) {
                if (!isDrawingMode || !isMouseDown) return;
                var rect = canvas.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                if (currentDrawingShape === 'rectangle') drawingPath = getRectanglePoints(drawingStartPoint.x, drawingStartPoint.y, x, y);
                else if (currentDrawingShape === 'circle') drawingPath = getCirclePoints(drawingStartPoint.x, drawingStartPoint.y, x, y, 32);
                endDrawingMode(true);
            });

            document.getElementById('addListModal').addEventListener('click', function(e) { if (e.target === this) closeAddListModal(); });
            document.getElementById('helpModal').addEventListener('click', function(e) { if (e.target === this) closeHelpModal(); });
            document.getElementById('listNameInput').addEventListener('keypress', function(e) { if (e.key === 'Enter') createNewList(); });

            document.getElementById('backupFileInput').addEventListener('change', function(e) { if (e.target.files && e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; });

            // Schedule Excel
            var scheduleFileInput = document.getElementById('scheduleFileInput');
            var scheduleDropZone = document.getElementById('scheduleDropZone');
            document.getElementById('btnScheduleChoose').addEventListener('click', function() { scheduleFileInput.click(); });
            scheduleDropZone.addEventListener('click', function() { scheduleFileInput.click(); });
            scheduleFileInput.addEventListener('change', function(e) { if (e.target.files && e.target.files[0]) handleZoneScheduleExcel(e.target.files[0]); e.target.value = ''; });
            ['dragenter', 'dragover'].forEach(function(evt) { scheduleDropZone.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); scheduleDropZone.classList.add('active'); }); });
            ['dragleave', 'drop'].forEach(function(evt) { scheduleDropZone.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); scheduleDropZone.classList.remove('active'); }); });
            scheduleDropZone.addEventListener('drop', function(e) { if (e.dataTransfer.files && e.dataTransfer.files[0]) handleZoneScheduleExcel(e.dataTransfer.files[0]); });
            document.getElementById('btnScheduleTemplate').addEventListener('click', downloadScheduleTemplate);

            // Load from view link → share link → localStorage (priority order)
            var viewLoaded = loadFromViewLink();
            if (!viewLoaded) {
                // If this tab had a view session but hash is gone (page refresh), show expired screen
                if (sessionStorage.getItem('mappoints_view_session') === '1') {
                    showViewExpiredScreen();
                    return;
                }
                var sharedLoaded = loadFromShareLink();
                if (sharedLoaded) {
                    showBackupStatus('Загружено из ссылки', 'success');
                    var stats = [];
                    if (pointsData.length > 0) stats.push(pointsData.length + ' точек');
                    if (deliveryZones.length > 0) stats.push(deliveryZones.length + ' ' + getZonesWord(deliveryZones.length));
                    if (stats.length > 0) showZoneStatus('Из ссылки: ' + stats.join(', '), 'success');
                } else {
                    var loaded = loadFromLocalStorage();
                    if (loaded) showBackupStatus('Данные восстановлены', 'success');
                }
            }
            updateStats();

            loadTheme();
            if (!isViewMode) renderProjectsList();
        });

        function toggleZoneLabels() {
            zoneLabelsVisible = !zoneLabelsVisible;
            deliveryZones.forEach(function(zone) {
                if (!zone.polygon) return;
                if (zoneLabelsVisible) {
                    zone.polygon.bindTooltip(zone.name || '', {
                        permanent: true,
                        direction: 'center',
                        className: 'zone-name-label',
                        interactive: false
                    });
                } else {
                    zone.polygon.unbindTooltip();
                }
            });
            var btn = document.getElementById('zoneLabelBtn');
            if (btn) btn.classList.toggle('fit-all-btn-active', zoneLabelsVisible);
        }

        // Global functions
        window.switchTab = switchTab;
        window.toggleAll = toggleAll;
        window.openAddListModal = openAddListModal;
        window.closeAddListModal = closeAddListModal;
        window.createNewList = createNewList;
        window.deleteCustomList = deleteCustomList;
        window.clearListPolygons = clearListPolygons;
        window.cancelDrawing = cancelDrawing;
        window.exportCustomList = exportCustomList;
        window.toggleAllZones = toggleAllZones;
        window.centerOnZone = centerOnZone;
        window.deleteZone = deleteZone;
        window.selectShape = selectShape;
        window.toggleGroupOutline = toggleGroupOutline;
        window.openHelpModal = openHelpModal;
        window.closeHelpModal = closeHelpModal;
        window.exportBackup = exportBackup;
        window.importBackup = importBackup;
        window.confirmClearAllData = confirmClearAllData;
        window.setTheme = setTheme;
        window.fitAllElements = fitAllElements;
        window.generateShareLink = generateShareLink;
        window.copyShareUrl = copyShareUrl;
        window.downloadScheduleTemplate = downloadScheduleTemplate;
        window.saveCurrentProject = saveCurrentProject;
        window.loadProject = loadProject;
        window.deleteProject = deleteProject;
        window.generateProjectViewLink = generateProjectViewLink;
        window.renderProjectsList = renderProjectsList;
        window.toggleZoneLabels = toggleZoneLabels;
