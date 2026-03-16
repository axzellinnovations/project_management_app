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

    @GetMapping("/documents/{documentId}/download-url")
    public ResponseEntity<Map<String, String>> getDownloadUrl(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        String downloadUrl = documentService.getDownloadUrl(projectId, documentId, principal.getUserId());
        return new ResponseEntity<>(Map.of("downloadUrl", downloadUrl), HttpStatus.OK);
    }

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

    @DeleteMapping("/documents/{documentId}")
    public ResponseEntity<Void> softDelete(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        documentService.softDelete(projectId, documentId, principal.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

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

    @DeleteMapping("/documents/{documentId}/permanent")
    public ResponseEntity<Void> permanentDelete(
            @PathVariable Long projectId,
            @PathVariable Long documentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        documentService.permanentDelete(projectId, documentId, principal.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

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

    @DeleteMapping("/folders/{folderId}")
    public ResponseEntity<Void> deleteFolder(
            @PathVariable Long projectId,
            @PathVariable Long folderId,
            @AuthenticationPrincipal UserPrincipal principal) {
        documentService.deleteFolder(projectId, folderId, principal.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
}
