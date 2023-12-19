import Chat from "@/app/[channelId]/chat"

export default async function ChatPage({params: {channelId}}) {
    const chatChannelId = await fetch(`https://api.chzzk.naver.com/polling/v1/channels/${channelId}/live-status`)
        .then(r => r.json())
        .then(data => data['content']['chatChannelId'])

    const accessToken = await fetch(`https://comm-api.game.naver.com/nng_main/v1/chats/access-token?channelId=${chatChannelId}&chatType=STREAMING`)
        .then(r => r.json())
        .then(data => data['content']['accessToken'])

    return (
        <Chat chatChannelId={chatChannelId} accessToken={accessToken}/>
    )
}
