export default function AlertModal() {
    return (
        <>
            <div className="alert" id="alert">
                <div className="alert-text"></div>
                <div className="alert-close fas fa-times"></div>
            </div>

            <div id="modal" className="modal modal-center"></div>
        </>
    )
}
