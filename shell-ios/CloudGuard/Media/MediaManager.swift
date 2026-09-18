import Foundation
import UIKit
import Photos
import PhotosUI

/// 相机 / 相册 / 保存相册 原生实现（iOS）。
///
/// 与 JS 契约（对齐 Android MediaManager）：
///   image.choose / image.chooseMedia  -> { images: [{base64, mimeType, name, size}] }
///       （Shim 层把 base64 还原为 File + blob URL，模拟 H5 uni.chooseImage 返回结构）
///   image.saveToAlbum                 <- { filePath, base64?, mimeType? }
final class MediaManager: NSObject {

    private weak var host: WebViewController?
    private let channel: JsChannel

    private var pendingChooseCallback: String?
    private var pendingCount = 1

    init(host: WebViewController, channel: JsChannel) {
        self.host = host
        self.channel = channel
    }

    func handle(method: String, params: [String: Any], callbackId: String) {
        switch method {
        case "image.choose", "image.chooseMedia":
            choose(params: params, callbackId: callbackId)
        case "image.saveToAlbum":
            saveToAlbum(params: params, callbackId: callbackId)
        default:
            channel.resolveErr(callbackId, "unknown image method: \(method)")
        }
    }

    // MARK: - 选择图片

    private func choose(params: [String: Any], callbackId: String?) {
        pendingChooseCallback = callbackId
        pendingCount = max(1, (params["count"] as? NSNumber)?.intValue ?? 1)
        let sourceType = (params["sourceType"] as? [String]) ?? ["camera", "album"]
        let hasCamera = sourceType.contains("camera")
        let hasAlbum = sourceType.contains("album")

        if hasCamera && hasAlbum && pendingCount == 1 {
            showSourceChooser()
        } else if hasCamera && !hasAlbum {
            launchCamera()
        } else {
            launchGallery()
        }
    }

    private func showSourceChooser() {
        let sheet = UIAlertController(title: "选择图片来源", message: nil, preferredStyle: .actionSheet)
        sheet.addAction(UIAlertAction(title: "拍照", style: .default) { [weak self] _ in self?.launchCamera() })
        sheet.addAction(UIAlertAction(title: "从相册选择", style: .default) { [weak self] _ in self?.launchGallery() })
        sheet.addAction(UIAlertAction(title: "取消", style: .cancel) { [weak self] _ in
            self?.finishChooseErr("已取消")
        })
        if let pop = sheet.popoverPresentationController, let view = host?.view {
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 0, height: 0)
        }
        host?.topViewController().present(sheet, animated: true)
    }

    private func launchGallery() {
        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.filter = .images
        config.selectionLimit = pendingCount
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        host?.topViewController().present(picker, animated: true)
    }

    private func launchCamera() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            finishChooseErr("相机不可用")
            return
        }
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = self
        host?.topViewController().present(picker, animated: true)
    }

    private func finishChooseErr(_ msg: String) {
        let cb = pendingChooseCallback
        pendingChooseCallback = nil
        channel.resolveErr(cb, msg)
    }

    private func finishChoose(images: [[String: Any]]) {
        let cb = pendingChooseCallback
        pendingChooseCallback = nil
        if images.isEmpty {
            channel.resolveErr(cb, "读取图片失败")
        } else {
            channel.resolveOk(cb, ["images": images])
        }
    }

    // MARK: - 图片 -> 字典

    private func imageToRecord(_ image: UIImage, name: String) -> [String: Any]? {
        let data = image.jpegData(compressionQuality: 0.9)
        guard let bytes = data else { return nil }
        return [
            "base64": bytes.base64EncodedString(),
            "mimeType": "image/jpeg",
            "name": name,
            "size": bytes.count
        ]
    }

    // MARK: - 保存到相册

    private func saveToAlbum(params: [String: Any], callbackId: String?) {
        let b64 = params["base64"] as? String ?? ""
        let filePath = params["filePath"] as? String ?? ""

        var image: UIImage?
        if !b64.isEmpty, let data = Data(base64Encoded: b64) {
            image = UIImage(data: data)
        } else if filePath.hasPrefix("file://") || filePath.hasPrefix("/") {
            let path = filePath.replacingOccurrences(of: "file://", with: "")
            image = UIImage(contentsOfFile: path)
        } else if filePath.hasPrefix("data:"), let comma = filePath.firstIndex(of: ",") {
            let encoded = String(filePath[filePath.index(after: comma)...])
            if let data = Data(base64Encoded: encoded) { image = UIImage(data: data) }
        }

        guard let target = image else {
            channel.resolveErr(callbackId, "无效的图片")
            return
        }

        PHPhotoLibrary.requestAuthorization { status in
            guard status == .authorized || status == .limited else {
                DispatchQueue.main.async { self.channel.resolveErr(callbackId, "无相册写入权限") }
                return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: target)
            }, completionHandler: { success, error in
                DispatchQueue.main.async {
                    if success {
                        self.channel.resolveOk(callbackId)
                    } else {
                        self.channel.resolveErr(callbackId, "保存失败: \(error?.localizedDescription ?? "unknown")")
                    }
                }
            })
        }
    }
}

// MARK: - PHPickerViewControllerDelegate

extension MediaManager: PHPickerViewControllerDelegate {

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        if results.isEmpty {
            finishChooseErr("未选择图片")
            return
        }
        let group = DispatchGroup()
        var records: [[String: Any]?] = Array(repeating: nil, count: results.count)
        let lock = NSLock()

        for (index, result) in results.enumerated() {
            let provider = result.itemProvider
            guard provider.canLoadObject(ofClass: UIImage.self) else { continue }
            group.enter()
            provider.loadObject(ofClass: UIImage.self) { object, _ in
                defer { group.leave() }
                guard let image = object as? UIImage else { return }
                let name = provider.suggestedName.map { "\($0).jpg" } ?? "image_\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
                let record = self.imageToRecord(image, name: name)
                lock.lock()
                records[index] = record
                lock.unlock()
            }
        }

        group.notify(queue: .main) {
            let images = records.compactMap { $0 }
            self.finishChoose(images: Array(images.prefix(self.pendingCount)))
        }
    }
}

// MARK: - UIImagePickerControllerDelegate（相机）

extension MediaManager: UIImagePickerControllerDelegate, UINavigationControllerDelegate {

    func imagePickerController(_ picker: UIImagePickerController,
                               didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)
        guard let image = info[.originalImage] as? UIImage else {
            finishChooseErr("已取消拍照")
            return
        }
        let name = "cap_\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        if let record = imageToRecord(image, name: name) {
            finishChoose(images: [record])
        } else {
            finishChooseErr("读取图片失败")
        }
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        finishChooseErr("已取消拍照")
    }
}
