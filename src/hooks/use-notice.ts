import {useEffect} from "react"

export default function useNotice() {
    useEffect(() => {
        if (window.obsstudio) {
            const dismissed = localStorage.getItem("notice-dismissed")

            if (!dismissed) {
                alert(`
                    ${"=".repeat(50)}

                    안녕하세요, 스트리머님!
                    제가 제작한 치지직 채팅창을 사용해 주셔서 감사합니다.

                    이제 웹사이트에서 커스터마이징이 가능한
                    새로운 채팅창을 사용하실 수 있습니다!

                    - 치지직 / 트위치 통합 채팅
                    - CSS, 폰트 설정
                    - 배지, 플랫폼 표시 등

                    아래 링크를 주소창에 복붙해서 접속해 주세요.

                    https://overlayz.kr

                    ${"=".repeat(50)}

                    (기존 오버레이는 동일하게 사용하실 수 있으며, 이 알림은 최초 1회만 표시됩니다)
                `)

                localStorage.setItem("notice-dismissed", "true")
            }
        }
    }, [])
}