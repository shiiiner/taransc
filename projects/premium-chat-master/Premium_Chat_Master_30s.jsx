// Premium_Chat_Master_30s.jsx
// ------------------------------------------------------------
// After Effects script — ExtendScript (ES3 compatible)
// Creates a 30-second vertical (1080x1920) premium minimal
// chat motion-graphics template (Master Template).
//
// HOW TO USE
// 1. Open After Effects
// 2. File > Scripts > Run Script File... → choose this file
// 3. A composition named "PREMIUM_CHAT_MASTER_30S" is created
// 4. Edit the SETTINGS block below to change texts, colors,
//    fonts and timing without touching the animation code.
//
// NOTE ABOUT PERSIAN / ARABIC TEXT
// After Effects may show Persian letters disconnected or LTR
// depending on the font. Choose a Persian-supporting font
// (e.g. "Tahoma", "Segoe UI", "Vazirmatn") and set the text
// layer direction to Right-to-Left in AE manually.
// ------------------------------------------------------------

if (app.project === null) {
    app.newProject();
}

// ======================= SETTINGS =======================
var SETTINGS = {
    compName: "PREMIUM_CHAT_MASTER_30S",
    width: 1080,
    height: 1920,
    duration: 30,     // seconds
    fps: 30,

    // Colors (RGB 0-1)
    colorBg:        [0.039, 0.043, 0.058],   // background
    colorPanel:     [0.098, 0.102, 0.125],   // chat panel
    colorBrand:     [0.22, 0.78, 0.58],      // brand accent (emerald)
    colorText:      [0.90, 0.93, 0.97],      // message text
    colorMuted:     [0.52, 0.55, 0.62],      // meta / dots
    colorUserBubble:[0.15, 0.16, 0.20],      // user bubble
    colorBrandBubble:[0.11, 0.115, 0.145],   // brand bubble
    colorAccent:    [0.22, 0.78, 0.58],      // check mark / accent

    // Fonts (must exist on your system — change to a Persian font if needed)
    fontMain:  "Arial",
    fontBold:  "Arial-BoldMT",

    // Logo / identity
    logoText: "Z",
    handle: "@brand.handle",

    // Conversation (edit freely — this is the master template content)
    messages: [
        {
            sender: "user",
            text: "سلام، این محصول برای چه نوع پوستی مناسبه؟",
            time: 4.0,      // typing starts (s)
            end: 8.5,       // typing ends (s)
            check: 8.7,     // check mark appears (s)
            bubbleY: 800
        },
        {
            sender: "brand",
            text: "سلام! این محصول برای پوست‌های چرب و مختلط طراحی شده و يساعد controlar روغنی دارد.",
            time: 14.0,
            end: 20.5,
            bubbleY: 1080
        },
        {
            sender: "user",
            text: "چطور باید ازش استفاده کنم؟",
            time: 21.0,
            end: 23.5,
            check: 23.7,
            bubbleY: 1360
        },
        {
            sender: "brand",
            text: "شبانه قبل از خواب، روی پوست تمیز و خشک بگذارید. صبح‌ها با آب شسته شود.",
            time: 25.0,
            end: 29.0,
            bubbleY: 1620
        }
    ],

    dots: { start: 11.0, end: 14.0, y: 990 },
    intro: { end: 4.0 },
    outro: { start: 29.0, end: 30.0 }
};
// ========================================================

var C = SETTINGS;

function addPosKeys(layer, keyframes) {
    var prop = layer.property("Position");
    for (var i = 0; i < keyframes.length; i++) {
        var k = keyframes[i];
        var idx = prop.addKey(k.time);
        prop.setValueAtKey(idx, k.value);
        prop.setTemporalEaseAtKey(idx, [new KeyframeEase(0.3, 0)], [new KeyframeEase(0.3, 0)]);
    }
    return prop;
}

function addOpacityKeys(layer, keyframes) {
    var prop = layer.property("Opacity");
    for (var i = 0; i < keyframes.length; i++) {
        var k = keyframes[i];
        var idx = prop.addKey(k.time);
        prop.setValueAtKey(idx, k.value);
        prop.setTemporalEaseAtKey(idx, [new KeyframeEase(0.3, 0)], [new KeyframeEase(0.3, 0)]);
    }
    return prop;
}

function addScaleKeys(layer, keyframes) {
    var prop = layer.property("Scale");
    for (var i = 0; i < keyframes.length; i++) {
        var k = keyframes[i];
        var idx = prop.addKey(k.time);
        prop.setValueAtKey(idx, k.value);
        prop.setTemporalEaseAtKey(idx, [new KeyframeEase(0.3, 0)], [new KeyframeEase(0.3, 0)]);
    }
    return prop;
}

function typewriterKeys(textLayer, startTime, endTime, text) {
    var textProp = textLayer.property("Source Text");
    var len = text.length;
    if (len === 0) { return; }
    textProp.setValueAtTime(startTime, new TextDocument(""));
    var steps = len;
    for (var i = 1; i <= steps; i++) {
        var t = startTime + ((i) / steps) * (endTime - startTime);
        textProp.setValueAtTime(t, new TextDocument(text.substring(0, i)));
    }
}

function makeTextDoc(text, font, size, color, justify) {
    var doc = new TextDocument(text);
    doc.font = font;
    doc.fontSize = size;
    doc.fillColor = color;
    doc.applyFill = true;
    doc.applyStroke = false;
    if (justify !== undefined) {
        doc.justify = justify;
    }
    return doc;
}

function createBubble(comp, name, width, height, position, fillColor, radius) {
    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = name;
    var contents = shapeLayer.property("Contents");
    var group = contents.addProperty("ADBE Vector Graphic - Group");
    var gContents = group.property("Contents");

    var rect = gContents.addProperty("ADBE Vector Shape - Rect");
    rect.property("Size").setValue([width, height]);
    rect.property("Position").setValue([width / 2, height / 2]);

    var round = gContents.addProperty("ADBE Vector Filter - Round Corners");
    round.property("Radius").setValue(radius);

    var fill = gContents.addProperty("ADBE Vector Graphic - Fill");
    fill.property("Color").setValue(fillColor);
    fill.property("Opacity").setValue(100);

    shapeLayer.property("Anchor Point").setValue([width / 2, height / 2]);
    shapeLayer.property("Position").setValue(position);
    return shapeLayer;
}

function createTextLayer(comp, name, text, font, size, color, position, justify) {
    var layer = comp.layers.addText(makeTextDoc(text, font, size, color, justify));
    layer.name = name;
    layer.property("Anchor Point").setValue([0, size / 2]);
    layer.property("Position").setValue(position);
    return layer;
}

function build() {
    app.beginUndoGroup("Create Premium Chat Master 30s");
    try {
        // Remove existing comp with same name
        for (var i = app.project.items.length; i >= 1; i--) {
            var item = app.project.items[i];
            if (item instanceof CompItem && item.name === C.compName) {
                item.remove();
            }
        }

        var comp = app.project.items.addComp(
            C.compName, C.width, C.height, 1.0, C.duration, C.fps
        );
        comp.workspace = "standard"; // not critical; ignore errors silently

        var cx = C.width / 2;   // 540
        var cy = C.height / 2;  // 960

        // ---------- Background ----------
        var bg = comp.layers.addSolid(C.colorBg, "Background", C.width, C.height, 1.0, C.duration);
        bg.property("Opacity").setValueAtTime(0, 0);
        bg.property("Opacity").setValueAtTime(1.0, 100);
        addOpacityKeys(bg, [
            { time: C.outro.start, value: 100 },
            { time: C.outro.end, value: 0 }
        ]);

        // ---------- Logo circle ----------
        var logoSize = 130;
        var logo = comp.layers.addShape();
        logo.name = "Logo Circle";
        var lContents = logo.property("Contents");
        var lGroup = lContents.addProperty("ADBE Vector Graphic - Group");
        var lRect = lGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
        lRect.property("Size").setValue([logoSize, logoSize]);
        lRect.property("Position").setValue([logoSize / 2, logoSize / 2]);
        var lFill = lGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
        lFill.property("Color").setValue(C.colorBrand);
        logo.property("Anchor Point").setValue([logoSize / 2, logoSize / 2]);
        logo.property("Position").setValue([cx, 240]);
        addScaleKeys(logo, [
            { time: 1.0, value: [0, 0] },
            { time: 2.6, value: [100, 100] },
            { time: C.outro.start + 0.2, value: [130, 130] },
            { time: C.outro.end, value: [0, 0] }
        ]);

        // ---------- Monogram ----------
        var mono = createTextLayer(comp, "Monogram", C.logoText, C.fontBold, 60, [1, 1, 1], [cx, 240], null);
        addOpacityKeys(mono, [
            { time: 2.0, value: 0 },
            { time: 2.5, value: 100 },
            { time: C.outro.start, value: 0 }
        ]);

        // ---------- Handle ----------
        var handle = createTextLayer(comp, "Handle", C.handle, C.fontMain, 26, C.colorMuted, [cx, 320], null);
        addOpacityKeys(handle, [
            { time: 2.6, value: 0 },
            { time: 3.1, value: 100 },
            { time: C.outro.start, value: 0 }
        ]);

        // ---------- Chat panel ----------
        var panelW = 780;
        var panelH = 1680;
        var panel = createBubble(comp, "Chat Panel", panelW, panelH, [cx, cy + 420], C.colorPanel, 52);
        addPosKeys(panel, [
            { time: C.intro.end - 1.4, value: [cx, cy + 420] },
            { time: C.intro.end, value: [cx, cy] }
        ]);
        addOpacityKeys(panel, [
            { time: C.intro.end - 1.4, value: 0 },
            { time: C.intro.end, value: 100 },
            { time: C.outro.start, value: 0 }
        ]);

        // ---------- Decorative rule under header ----------
        var rule = comp.layers.addSolid(C.colorMuted, "Header Rule", 160, 1, 1.0, C.duration);
        rule.property("Anchor Point").setValue([80, 0.5]);
        rule.property("Position").setValue([cx, 390]);
        addOpacityKeys(rule, [
            { time: 3.2, value: 0 },
            { time: 3.7, value: 60 },
            { time: C.outro.start, value: 0 }
        ]);

        // ---------- Footer line ----------
        var footer = comp.layers.addSolid(C.colorMuted, "Footer Line", 640, 1, 1.0, C.duration);
        footer.property("Anchor Point").setValue([320, 0.5]);
        footer.property("Position").setValue([cx, 1850]);
        footer.property("Opacity").setValue(30);

        // ---------- Build messages ----------
        var i;
        for (i = 0; i < C.messages.length; i++) {
            var msg = C.messages[i];
            var isUser = (msg.sender === "user");
            var bubbleColor = isUser ? C.colorUserBubble : C.colorBrandBubble;
            var textColor = C.colorText;

            // Estimate bubble width from text length (approx. chars)
            var estW = Math.min(640, Math.max(260, msg.text.length * 19 + 70));
            var estH = msg.text.length > 44 ? 150 : 115;
            var padX = isUser ? 50 : 50;
            var textX = isUser ? cx + 220 - padX : cx - 220 + padX;
            var bubbleX = isUser ? cx + 230 : cx - 230;

            var bubble = createBubble(
                comp, "Bubble " + i, estW, estH,
                [bubbleX, msg.bubbleY], bubbleColor, 30
            );
            bubble.property("Opacity").setValue(0);

            // Bubble slide-in: from outside toward center
            var startX = isUser ? bubbleX + 520 : bubbleX - 520;
            addPosKeys(bubble, [
                { time: msg.time, value: [startX, msg.bubbleY] },
                { time: msg.time + 0.7, value: [bubbleX, msg.bubbleY] }
            ]);
            addOpacityKeys(bubble, [
                { time: msg.time, value: 0 },
                { time: msg.time + 0.7, value: 100 },
                { time: C.outro.start, value: 0 }
            ]);

            // Message text (typewriter)
            var justify = isUser ? 2 : 0; // RIGHT_JUSTIFY=2, LEFT_JUSTIFY=0
            var textLayer = createTextLayer(
                comp, "Text " + i, "", C.fontMain, 34, textColor,
                [textX, msg.bubbleY + 4], justify
            );
            typewriterKeys(textLayer, msg.time, msg.end, msg.text);
            addOpacityKeys(textLayer, [
                { time: msg.time, value: 0 },
                { time: msg.time + 0.6, value: 100 },
                { time: C.outro.start, value: 0 }
            ]);

            // Timestamp under bubble
            var tsText = isUser ? "۱۲:۰۴" : "۱۲:۰۵";
            var ts = createTextLayer(
                comp, "Time " + i, tsText, C.fontMain, 20, C.colorMuted,
                [textX, msg.bubbleY + estH / 2 + 26], justify
            );
            addOpacityKeys(ts, [
                { time: msg.end + 0.2, value: 0 },
                { time: msg.end + 0.8, value: 60 },
                { time: C.outro.start, value: 0 }
            ]);

            // Check mark for user messages
            if (isUser && msg.check) {
                var check = createTextLayer(
                    comp, "Check " + i, "✓", C.fontBold, 24, C.colorAccent,
                    [textX + 40, msg.bubbleY + estH / 2 + 10], null
                );
                addScaleKeys(check, [
                    { time: msg.check, value: [0, 0] },
                    { time: msg.check + 0.25, value: [130, 130] },
                    { time: msg.check + 0.5, value: [100, 100] }
                ]);
                addOpacityKeys(check, [
                    { time: msg.check, value: 0 },
                    { time: msg.check + 0.2, value: 100 },
                    { time: C.outro.start, value: 0 }
                ]);
            }
        }

        // ---------- Typing dots (brand responding) ----------
        var dotSize = 12;
        var dotGap = 16;
        var dotsStartY = C.dots.y;
        var dotsBaseX = cx - dotSize - dotGap; // center 3 dots
        var d;
        for (d = 0; d < 3; d++) {
            var dot = comp.layers.addShape();
            dot.name = "Dot " + (d + 1);
            var dContents = dot.property("Contents");
            var dGroup = dContents.addProperty("ADBE Vector Graphic - Group");
            var dRect = dGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
            dRect.property("Size").setValue([dotSize, dotSize]);
            dRect.property("Position").setValue([dotSize / 2, dotSize / 2]);
            var dFill = dGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
            dFill.property("Color").setValue(C.colorMuted);
            dot.property("Anchor Point").setValue([dotSize / 2, dotSize / 2]);
            dot.property("Position").setValue([dotsBaseX + d * (dotSize + dotGap), dotsStartY]);

            var t;
            for (t = C.dots.start; t < C.dots.end; t += 0.75) {
                var offset = d * 0.25;
                addOpacityKeys(dot, [
                    { time: t + offset, value: 30 },
                    { time: t + offset + 0.2, value: 100 },
                    { time: t + offset + 0.55, value: 30 }
                ]);
            }
            addOpacityKeys(dot, [
                { time: C.dots.end, value: 0 }
            ]);
        }

        // ---------- Cursor blink during typings ----------
        // (one blinking caret shown while any user message is typing)
        var cursor = createTextLayer(comp, "Cursor", "|", C.fontBold, 34, C.colorText, [cx + 260, 804], null);
        var blink;
        for (blink = C.messages[0].time; blink < C.messages[0].end; blink += 0.45) {
            addOpacityKeys(cursor, [
                { time: blink, value: 100 },
                { time: blink + 0.22, value: 0 },
                { time: blink + 0.44, value: 100 }
            ]);
        }
        addOpacityKeys(cursor, [
            { time: C.messages[0].end, value: 0 },
            { time: C.outro.start, value: 0 }
        ]);

        app.endUndoGroup();
        alert("Done! Composition \"" + C.compName + "\" created (" + C.duration + " seconds).");
    } catch (err) {
        try { app.endUndoGroup(); } catch (e) {}
        alert("Error creating Premium Chat Master:\n" + err.toString());
    }
}

build();
