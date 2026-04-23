package com.planora.backend.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import static org.junit.jupiter.api.Assertions.*;

class S3ConfigTest {

    @Test
    void s3Client_isCreatedSuccessfully() {
        S3Config config = new S3Config();
        ReflectionTestUtils.setField(config, "accessKey", "AKIAFAKEACCESSKEY");
        ReflectionTestUtils.setField(config, "secretKey", "FakeSecretKey/FakeSecretKeyFakeSecret");
        ReflectionTestUtils.setField(config, "region", "us-east-1");

        S3Client client = config.s3Client();

        assertNotNull(client);
        client.close();
    }

    @Test
    void s3Presigner_isCreatedSuccessfully() {
        S3Config config = new S3Config();
        ReflectionTestUtils.setField(config, "accessKey", "AKIAFAKEACCESSKEY");
        ReflectionTestUtils.setField(config, "secretKey", "FakeSecretKey/FakeSecretKeyFakeSecret");
        ReflectionTestUtils.setField(config, "region", "eu-west-1");

        S3Presigner presigner = config.s3Presigner();

        assertNotNull(presigner);
        presigner.close();
    }

    @Test
    void s3Client_withDifferentRegion_doesNotThrow() {
        S3Config config = new S3Config();
        ReflectionTestUtils.setField(config, "accessKey", "AKIAFAKEACCESSKEY");
        ReflectionTestUtils.setField(config, "secretKey", "FakeSecretKey/FakeSecretKeyFakeSecret");
        ReflectionTestUtils.setField(config, "region", "ap-southeast-1");

        assertDoesNotThrow(() -> {
            S3Client client = config.s3Client();
            client.close();
        });
    }
}
