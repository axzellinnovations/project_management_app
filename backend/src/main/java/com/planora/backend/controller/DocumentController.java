package com.planora.backend.controller;

import com.planora.backend.dto.*;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.DocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects/{projectId}")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    // ── Direct-to-S3 Upload Pipeline ──────────────────────────────────────────────

    /*
     * PHASE 1: Initialize Upload.
     * The frontend tells us it *wants* to upload a file (giving us the name and size).
     * We return a temporary, cryptographic URL that allows the frontend to push
     * the binary data directly to AWS S3, bypassing our server entirely.
     */
    @PostMapping("/documents/upload/init")
    public ResponseEntity<DocumentUploadInitResponseDTO> initUpload(
            @PathVariable Long projectId,
            @Valid @RequestBody DocumentUploadInitRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.initUpload(projectId, principal.getUserId(), request),
                HttpStatus.OK
        );
    }

    /*
     * PHASE 2: Finalize Upload.
     * The frontend calls this AFTER the direct-to-S3 upload succeeds.
     * We verify the file is actually sitting in our AWS bucket, and then we create
     * the official database record linking it to the project.
     */
    @PostMapping("/documents/upload/finalize")
    public ResponseEntity<DocumentResponseDTO> finalizeUpload(
            @PathVariable Long projectId,
            @Valid @RequestBody DocumentUploadFinalizeRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.finalizeUpload(projectId, principal.getUserId(), request),
                HttpStatus.CREATED
        );
    }

    /*
     * FALLBACK: Server-Proxied Upload.
     * For older clients or scripts that cannot handle the 2-step presigned URL process.
     * The file hits our Spring Boot server's RAM, and we proxy it to AWS.
     * Consumes multipart/form-data.
     */
    @PostMapping(value = "/documents/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentResponseDTO> uploadViaBackend(
            @PathVariable Long projectId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folderId", required = false) Long folderId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.uploadDocumentViaBackend(projectId, principal.getUserId(), file, folderId),
                HttpStatus.CREATED
        );
        }

    // ── Version Control ───────────────────────────────────────────────────────────

    /*
     * PHASE 1 for uploading a *new version* of an *existing* document.
     * Sub-Resource Routing: `/documents/{documentId}/versions/...`
     */
    @PostMapping("/documents/{documentId}/versions/upload/init")
    public ResponseEntity<DocumentUploadInitResponseDTO> initVersionUpload(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @Valid @RequestBody DocumentUploadInitRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.initNewVersionUpload(projectId, documentId, principal.getUserId(), request),
                HttpStatus.OK
        );
    }

    /*
     * PHASE 2 for finalizing a new document version.
     */
    @PostMapping("/documents/{documentId}/versions/upload/finalize")
    public ResponseEntity<DocumentResponseDTO> finalizeVersionUpload(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @Valid @RequestBody DocumentUploadFinalizeRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.finalizeNewVersionUpload(projectId, documentId, principal.getUserId(), request),
                HttpStatus.CREATED
        );
    }

    // ── Document Retrieval & Downloads ────────────────────────────────────────────

    /*
     * Fetches the file explorer view.
     * Supports query params to filter by a specific folder or to view the "Trash" (includeDeleted).
     */
    @GetMapping("/documents")
    public ResponseEntity<List<DocumentResponseDTO>> listDocuments(
            @PathVariable Long projectId,
            @RequestParam(required = false) Long folderId,
            @RequestParam(defaultValue = "false") boolean includeDeleted,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.listDocuments(projectId, principal.getUserId(), folderId, includeDeleted),
                HttpStatus.OK
        );
    }

    @GetMapping("/documents/{documentId}")
    public ResponseEntity<DocumentResponseDTO> getDocumentById(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.getDocumentById(projectId, documentId, principal.getUserId()),
                HttpStatus.OK
        );
    }

    /*
     * We don't stream the file bytes through the backend.
     * Instead, we generate a secure, short-lived AWS S3 link that the browser can download directly.
     */
    @GetMapping("/documents/{documentId}/download-url")
    public ResponseEntity<Map<String, String>> getDownloadUrl(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        String downloadUrl = documentService.getDownloadUrl(projectId, documentId, principal.getUserId());
        return new ResponseEntity<>(Map.of("downloadUrl", downloadUrl), HttpStatus.OK);
    }

    // Lists all historical versions of a specific document.
    @GetMapping("/documents/{documentId}/versions")
    public ResponseEntity<List<DocumentVersionResponseDTO>> getVersions(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.getVersions(projectId, documentId, principal.getUserId()),
                HttpStatus.OK
        );
    }

    // ── Document Metadata & Lifecycle (Trash Bin) ─────────────────────────────────

    /*
     * Allows renaming a document or moving it to a different folder.
     * Uses PATCH because we are only partially updating the metadata, not replacing the file content.
     */
    @PatchMapping("/documents/{documentId}")
    public ResponseEntity<DocumentResponseDTO> updateMetadata(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @RequestBody DocumentMetadataUpdateRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.updateMetadata(projectId, documentId, principal.getUserId(), request),
                HttpStatus.OK
        );
    }

    /*
     * SOFT DELETE: Moves the document to the "Trash" state without actually deleting
     * the physical file from S3 yet.
     */
    @DeleteMapping("/documents/{documentId}")
    public ResponseEntity<Void> softDelete(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        documentService.softDelete(projectId, documentId, principal.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    /*
     * Pulls a document out of the Trash and back into active status.
     */
    @PatchMapping("/documents/{documentId}/restore")
    public ResponseEntity<DocumentResponseDTO> restore(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.restore(projectId, documentId, principal.getUserId()),
                HttpStatus.OK
        );
    }

    /*
     * HARD DELETE: Instantly wipes the database records and deletes all physical
     * files and historical versions from AWS S3. Cannot be undone.
     */
    @DeleteMapping("/documents/{documentId}/permanent")
    public ResponseEntity<Void> permanentDelete(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        documentService.permanentDelete(projectId, documentId, principal.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    // ── Folder Management ─────────────────────────────────────────────────────────

    @PostMapping("/folders")
    public ResponseEntity<DocumentFolderResponseDTO> createFolder(
            @PathVariable Long projectId,
            @Valid @RequestBody DocumentFolderCreateRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.createFolder(projectId, principal.getUserId(), request),
                HttpStatus.CREATED
        );
    }

    @GetMapping("/folders")
    public ResponseEntity<List<DocumentFolderResponseDTO>> listFolders(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.listFolders(projectId, principal.getUserId()),
                HttpStatus.OK
        );
    }

    @PatchMapping("/folders/{folderId}")
    public ResponseEntity<DocumentFolderResponseDTO> updateFolder(
            @PathVariable Long projectId,
            @PathVariable Long folderId,
            @Valid @RequestBody DocumentFolderUpdateRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                documentService.updateFolder(projectId, folderId, principal.getUserId(), request),
                HttpStatus.OK
        );
    }

    /*
     * Deleting a folder will recursively soft-delete all child folders and documents inside it.
     */
    @DeleteMapping("/folders/{folderId}")
    public ResponseEntity<Void> deleteFolder(
            @PathVariable Long projectId,
            @PathVariable Long folderId,
            @AuthenticationPrincipal UserPrincipal principal) {
        documentService.deleteFolder(projectId, folderId, principal.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
}
