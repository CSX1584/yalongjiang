import AppKit

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: AppIcon.swift <output.png>\n", stderr)
    exit(2)
}

let canvas = NSSize(width: 1024, height: 1024)
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: 1024,
    pixelsHigh: 1024,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bitmapFormat: [],
    bytesPerRow: 0,
    bitsPerPixel: 0
), let graphicsContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fputs("Unable to create icon canvas\n", stderr)
    exit(1)
}
bitmap.size = canvas
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = graphicsContext

let bounds = NSRect(origin: .zero, size: canvas)
let outer = NSBezierPath(roundedRect: bounds.insetBy(dx: 40, dy: 40), xRadius: 220, yRadius: 220)
let gradient = NSGradient(colors: [
    NSColor(calibratedRed: 0.015, green: 0.055, blue: 0.105, alpha: 1),
    NSColor(calibratedRed: 0.020, green: 0.180, blue: 0.270, alpha: 1),
])!
gradient.draw(in: outer, angle: -55)

let riverGlow = NSBezierPath()
riverGlow.move(to: NSPoint(x: 280, y: 850))
riverGlow.curve(to: NSPoint(x: 635, y: 555),
                controlPoint1: NSPoint(x: 570, y: 785),
                controlPoint2: NSPoint(x: 445, y: 650))
riverGlow.curve(to: NSPoint(x: 725, y: 185),
                controlPoint1: NSPoint(x: 830, y: 430),
                controlPoint2: NSPoint(x: 545, y: 350))
riverGlow.lineCapStyle = .round
riverGlow.lineJoinStyle = .round
NSColor(calibratedRed: 0.05, green: 0.68, blue: 0.95, alpha: 0.20).setStroke()
riverGlow.lineWidth = 132
riverGlow.stroke()

NSColor(calibratedRed: 0.19, green: 0.86, blue: 1.0, alpha: 1).setStroke()
riverGlow.lineWidth = 54
riverGlow.stroke()

for point in [NSPoint(x: 312, y: 842), NSPoint(x: 637, y: 555), NSPoint(x: 710, y: 210)] {
    let halo = NSBezierPath(ovalIn: NSRect(x: point.x - 42, y: point.y - 42, width: 84, height: 84))
    NSColor(calibratedRed: 0.05, green: 0.68, blue: 0.95, alpha: 0.26).setFill()
    halo.fill()
    let node = NSBezierPath(ovalIn: NSRect(x: point.x - 18, y: point.y - 18, width: 36, height: 36))
    NSColor.white.setFill()
    node.fill()
}

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center
let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 146, weight: .heavy),
    .foregroundColor: NSColor.white,
    .kern: 12,
    .paragraphStyle: paragraph,
]
NSString(string: "OPS").draw(in: NSRect(x: 140, y: 92, width: 744, height: 180), withAttributes: attributes)

graphicsContext.flushGraphics()
NSGraphicsContext.restoreGraphicsState()
guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Unable to encode icon\n", stderr)
    exit(1)
}
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
