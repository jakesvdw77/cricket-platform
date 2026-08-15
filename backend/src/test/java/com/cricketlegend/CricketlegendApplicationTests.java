package com.cricketlegend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(AbstractIntegrationTest.class)
class CricketlegendApplicationTests {

    @Test
    void contextLoads() {
    }
}
