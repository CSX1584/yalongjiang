import Foundation

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: CreateICNS.swift <png-directory> <output.icns>\n", stderr)
    exit(2)
}

let pngDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let representations: [(type: String, pixels: Int)] = [
    ("icp4", 16),
    ("icp5", 32),
    ("icp6", 64),
    ("ic07", 128),
    ("ic08", 256),
    ("ic09", 512),
    ("ic10", 1024),
]

func bigEndianBytes(_ value: UInt32) -> [UInt8] {
    let bigEndian = value.bigEndian
    return withUnsafeBytes(of: bigEndian) { Array($0) }
}

var chunks = Data()
for representation in representations {
    let pngURL = pngDirectory.appendingPathComponent("\(representation.pixels).png")
    let png = try Data(contentsOf: pngURL)
    guard let type = representation.type.data(using: .ascii), type.count == 4 else {
        fputs("Invalid ICNS representation type\n", stderr)
        exit(1)
    }
    chunks.append(type)
    chunks.append(contentsOf: bigEndianBytes(UInt32(png.count + 8)))
    chunks.append(png)
}

var file = Data("icns".utf8)
file.append(contentsOf: bigEndianBytes(UInt32(chunks.count + 8)))
file.append(chunks)
try file.write(to: outputURL)
