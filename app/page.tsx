export default function Home() {
    return (
        <main style={{color: "black"}}>
            <h1>치지직 오버레이</h1>
            <p>
                두로님 채팅창을 치지직 버전으로 포팅했습니다.<br/>
                다른 스트리머 분들도 뒤에 주소만 바꾸면 사용이 가능합니다.
            </p>
            <h3>
                예시
            </h3>
            <p>
                두로님 치지직 주소: https://chzzk.naver.com/6e06f5e1907f17eff543abd06cb62891<br/>
                오버레이 주소: https://chzzk-overlay.vercel.app/6e06f5e1907f17eff543abd06cb62891
            </p>
            <p>
                추가로, 오버레이 뒤에 <code>?small</code> 을 붙이면 채팅 간격이 넓어집니다.
            </p>
        </main>
    )
}
